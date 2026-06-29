// Supabase Edge Function: generate-menus
// ----------------------------------------------------------------------------
// Generates exactly 5 menu options for one meal slot via the Claude API.
// Implements RULES R6 (on-demand + caching, validate, 1 retry, model
// claude-opus-4-8) and PLAN section 4 data flow:
//   1) On non-refresh: look up menu_cache by constraint key -> return on hit.
//   2) On miss or refresh: call Claude -> validate (R2) -> cache (non-refresh).
//
// The Claude API key lives ONLY in this server-side function (Deno.env).
// Never expose it to the browser (RULES R6-1, PLAN 4).
// ----------------------------------------------------------------------------

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, handleOptions, jsonResponse } from "../_shared/cors.ts";
import {
  buildSingleSystemPrompt,
  buildSingleUserPrompt,
  buildSystemPrompt,
  buildUserPrompt,
  type GenerateMenusRequest,
  type GenerateSingleRequest,
} from "./prompt.ts";

// --- Constants (RULES R0/R2/R6) ---------------------------------------------
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const MODEL = "claude-opus-4-8"; // RULES R6-4 (quality-first default)
const MAX_TOKENS = 4096;
const EXPECTED_OPTION_COUNT = 5; // RULES R1-1

const CUISINE_CODES = ["KR", "CN", "JP", "WS", "DINEOUT"] as const;
const HOME_CUISINE_CODES = ["KR", "CN", "JP", "WS"] as const;
const UNIT_CODES = [
  "g", "kg", "ml", "L", "개", "장", "쪽", "대", "컵", "큰술", "작은술", "약간",
] as const;
const CATEGORY_CODES = [
  "vegetable", "fruit", "meat", "seafood", "dairy", "grain", "seasoning", "etc",
] as const;
const DIFFICULTY_CODES = ["easy", "medium", "hard"] as const;

// --- Lightweight request parsing --------------------------------------------
// Hand-rolled guard (instead of importing shared/schema.ts zod across the Deno
// boundary, which is fragile) — mirrors GenerateMenusRequestSchema.
function parseRequest(body: unknown): GenerateMenusRequest {
  if (typeof body !== "object" || body === null) {
    throw new ValidationError("request body must be a JSON object");
  }
  const b = body as Record<string, unknown>;

  const dayIndex = b.dayIndex;
  if (
    typeof dayIndex !== "number" || !Number.isInteger(dayIndex) ||
    dayIndex < 0 || dayIndex > 6
  ) {
    throw new ValidationError("dayIndex must be an integer 0..6");
  }

  if (b.meal !== "lunch" && b.meal !== "dinner") {
    throw new ValidationError('meal must be "lunch" or "dinner"');
  }

  const servings = b.servings;
  if (
    typeof servings !== "number" || !Number.isInteger(servings) || servings < 1
  ) {
    throw new ValidationError("servings must be a positive integer");
  }

  const excludedCuisines = asStringArray(b.excludedCuisines, "excludedCuisines");
  for (const c of excludedCuisines) {
    if (!(CUISINE_CODES as readonly string[]).includes(c)) {
      throw new ValidationError(`excludedCuisines contains invalid code: ${c}`);
    }
  }

  return {
    dayIndex,
    meal: b.meal,
    excludedCuisines,
    servings,
    allergies: asStringArray(b.allergies, "allergies"),
    dislikedIngredients: asStringArray(
      b.dislikedIngredients,
      "dislikedIngredients",
    ),
    excludedMenuNames: asStringArray(b.excludedMenuNames, "excludedMenuNames"),
    preferenceHints: (typeof b.preferenceHints === "object" &&
        b.preferenceHints !== null)
      ? (b.preferenceHints as Record<string, unknown>)
      : undefined,
    isRefresh: Boolean(b.isRefresh),
  };
}

function asStringArray(value: unknown, field: string): string[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.some((v) => typeof v !== "string")) {
    throw new ValidationError(`${field} must be an array of strings`);
  }
  return value as string[];
}

// --- Response (R2) validation ------------------------------------------------
// Hand-rolled guard mirroring MenuOptionsResponseSchema (shared/schema.ts).
function validateMenuOptions(value: unknown): value is unknown[] {
  if (!Array.isArray(value) || value.length !== EXPECTED_OPTION_COUNT) {
    return false;
  }
  return value.every(isValidMenuOption);
}

function isValidMenuOption(item: unknown): boolean {
  if (typeof item !== "object" || item === null) return false;
  const m = item as Record<string, unknown>;

  if (!nonEmptyString(m.name) || !nonEmptyString(m.description)) return false;
  if (!Array.isArray(m.tags) || m.tags.some((t) => typeof t !== "string")) {
    return false;
  }

  if (m.type === "home") {
    if (!(HOME_CUISINE_CODES as readonly string[]).includes(m.cuisine as string)) {
      return false;
    }
    if (!(DIFFICULTY_CODES as readonly string[]).includes(m.difficulty as string)) {
      return false;
    }
    if (typeof m.cookTimeMin !== "number") return false;
    if (typeof m.servings !== "number") return false;
    if (typeof m.estimatedCalories !== "number") return false;
    if (!isValidRecipe(m.recipe)) return false;
    if (!Array.isArray(m.ingredients) || !m.ingredients.every(isValidIngredient)) {
      return false;
    }
    return true;
  }

  if (m.type === "dineout") {
    if (m.cuisine !== "DINEOUT") return false;
    if (!nonEmptyString(m.searchKeyword)) return false;
    return true;
  }

  return false; // unknown type
}

function isValidRecipe(value: unknown): boolean {
  if (typeof value !== "object" || value === null) return false;
  const r = value as Record<string, unknown>;
  const okSteps = Array.isArray(r.steps) &&
    r.steps.every((s) => typeof s === "string");
  const okTips = Array.isArray(r.tips) &&
    r.tips.every((t) => typeof t === "string");
  return okSteps && okTips;
}

function isValidIngredient(value: unknown): boolean {
  if (typeof value !== "object" || value === null) return false;
  const i = value as Record<string, unknown>;
  return (
    nonEmptyString(i.name) &&
    typeof i.quantity === "number" &&
    (UNIT_CODES as readonly string[]).includes(i.unit as string) &&
    (CATEGORY_CODES as readonly string[]).includes(i.category as string) &&
    typeof i.pantryStaple === "boolean"
  );
}

function nonEmptyString(value: unknown): boolean {
  return typeof value === "string" && value.length > 0;
}

// --- Cache key (RULES R6-2) --------------------------------------------------
// Constraint key from {dayIndex, meal, sorted excludedCuisines, servings}.
function buildCacheKey(req: GenerateMenusRequest): string {
  const cuisines = [...req.excludedCuisines].sort().join(",");
  return `${req.dayIndex}|${req.meal}|${cuisines}|${req.servings}`;
}

// --- Claude call (RULES R6) --------------------------------------------------
async function callClaude(
  apiKey: string,
  systemPrompt: string,
  userPrompt: string,
): Promise<unknown> {
  const res = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": ANTHROPIC_VERSION,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new UpstreamError(
      `Anthropic API returned ${res.status}: ${detail.slice(0, 500)}`,
    );
  }

  const data = await res.json();
  const text: unknown = data?.content?.[0]?.text;
  if (typeof text !== "string") {
    throw new UpstreamError("Anthropic response missing content[0].text");
  }

  return JSON.parse(stripCodeFences(text));
}

/** Defensive: strip ``` fences if the model adds them despite instructions. */
function stripCodeFences(text: string): string {
  const trimmed = text.trim();
  if (!trimmed.startsWith("```")) return trimmed;
  return trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
}

/**
 * Generate + validate with one retry (RULES R6-3).
 * Returns a validated array of 5 menu options or throws UpstreamError.
 */
async function generateValidated(
  apiKey: string,
  req: GenerateMenusRequest,
): Promise<unknown[]> {
  const systemPrompt = buildSystemPrompt();
  const userPrompt = buildUserPrompt(req);

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const options = await callClaude(apiKey, systemPrompt, userPrompt);
      if (validateMenuOptions(options)) return options;
      console.warn(
        `generate-menus: validation failed (attempt ${attempt + 1}/2)`,
      );
    } catch (err) {
      // JSON parse / upstream error — retry once, then surface.
      console.warn(
        `generate-menus: Claude attempt ${attempt + 1}/2 failed:`,
        err instanceof Error ? err.message : err,
      );
      if (attempt === 1) {
        throw err instanceof UpstreamError
          ? err
          : new UpstreamError(
            err instanceof Error ? err.message : "Claude call failed",
          );
      }
    }
  }

  throw new UpstreamError(
    "Claude output failed R2 validation twice (1 retry exhausted)",
  );
}

// --- Single-menu mode (search & add) ----------------------------------------
function isSingleMode(body: unknown): boolean {
  return (
    typeof body === "object" && body !== null &&
    (body as Record<string, unknown>).mode === "single"
  );
}

function parseSingleRequest(body: unknown): GenerateSingleRequest {
  const b = body as Record<string, unknown>;
  if (!nonEmptyString(b.requestedName)) {
    throw new ValidationError("requestedName must be a non-empty string");
  }
  if (b.meal !== "lunch" && b.meal !== "dinner") {
    throw new ValidationError('meal must be "lunch" or "dinner"');
  }
  return {
    mode: "single",
    requestedName: b.requestedName as string,
    meal: b.meal,
    cuisineHint: typeof b.cuisineHint === "string" ? b.cuisineHint : undefined,
  };
}

/** Generate + validate ONE menu object with one retry (RULES R6-3). */
async function generateSingleValidated(
  apiKey: string,
  req: GenerateSingleRequest,
): Promise<unknown> {
  const systemPrompt = buildSingleSystemPrompt();
  const userPrompt = buildSingleUserPrompt(req);

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const menu = await callClaude(apiKey, systemPrompt, userPrompt);
      if (isValidMenuOption(menu)) return menu;
      console.warn(
        `generate-menus(single): validation failed (attempt ${attempt + 1}/2)`,
      );
    } catch (err) {
      console.warn(
        `generate-menus(single): Claude attempt ${attempt + 1}/2 failed:`,
        err instanceof Error ? err.message : err,
      );
      if (attempt === 1) {
        throw err instanceof UpstreamError
          ? err
          : new UpstreamError(
            err instanceof Error ? err.message : "Claude call failed",
          );
      }
    }
  }

  throw new UpstreamError(
    "Single menu output failed R2 validation twice (1 retry exhausted)",
  );
}

async function handleSingle(body: unknown, apiKey: string): Promise<Response> {
  let parsed: GenerateSingleRequest;
  try {
    parsed = parseSingleRequest(body);
  } catch (err) {
    return jsonResponse(
      { error: err instanceof ValidationError ? err.message : "Invalid request" },
      400,
    );
  }

  try {
    const menu = await generateSingleValidated(apiKey, parsed);
    return jsonResponse({ menu });
  } catch (err) {
    console.error(
      "generate-menus(single): generation failed:",
      err instanceof Error ? err.message : err,
    );
    return jsonResponse(
      { error: "Failed to generate valid menu", detail: String(err) },
      502,
    );
  }
}

// --- Typed errors ------------------------------------------------------------
class ValidationError extends Error {}
class UpstreamError extends Error {}

// --- Handler -----------------------------------------------------------------
Deno.serve(async (req: Request): Promise<Response> => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  // Claude key is required by both modes (RULES R6-1).
  const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!anthropicKey) {
    console.error("generate-menus: missing ANTHROPIC_API_KEY");
    return jsonResponse({ error: "Server is not configured" }, 500);
  }

  // Read the body once (used by both modes).
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  // Single-menu mode (search & add) — no cache, only needs the Claude key.
  if (isSingleMode(body)) {
    return await handleSingle(body, anthropicKey);
  }

  // 5-option mode also needs the cache (Supabase) secrets.
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    console.error("generate-menus: missing Supabase environment secrets");
    return jsonResponse({ error: "Server is not configured" }, 500);
  }

  // Parse + validate the request.
  let parsed: GenerateMenusRequest;
  try {
    parsed = parseRequest(body);
  } catch (err) {
    const message = err instanceof ValidationError
      ? err.message
      : "Invalid JSON body";
    return jsonResponse({ error: message }, 400);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });
  const cacheKey = buildCacheKey(parsed);

  // 1) Cache lookup (RULES R6-2) — skip on refresh.
  if (!parsed.isRefresh) {
    const { data: cached, error: cacheErr } = await supabase
      .from("menu_cache")
      .select("payload, hit_count")
      .eq("cache_key", cacheKey)
      .maybeSingle();

    if (cacheErr) {
      // Cache is an optimization — log and fall through to generation.
      console.warn("generate-menus: cache lookup failed:", cacheErr.message);
    } else if (cached?.payload) {
      // Increment hit_count (best-effort).
      await supabase
        .from("menu_cache")
        .update({ hit_count: (cached.hit_count ?? 0) + 1 })
        .eq("cache_key", cacheKey);
      return jsonResponse({ options: cached.payload, cached: true });
    }
  }

  // 2) Generate via Claude + validate (R2) with 1 retry (R6-3).
  let options: unknown[];
  try {
    options = await generateValidated(anthropicKey, parsed);
  } catch (err) {
    console.error(
      "generate-menus: generation failed:",
      err instanceof Error ? err.message : err,
    );
    return jsonResponse(
      { error: "Failed to generate valid menus", detail: String(err) },
      502,
    );
  }

  // 3) Upsert into cache on the non-refresh path (RULES R6-2).
  if (!parsed.isRefresh) {
    const { error: upsertErr } = await supabase
      .from("menu_cache")
      .upsert(
        {
          cache_key: cacheKey,
          day_index: parsed.dayIndex,
          meal: parsed.meal,
          excluded_cuisines: [...parsed.excludedCuisines].sort(),
          servings: parsed.servings,
          payload: options,
          hit_count: 0,
        },
        { onConflict: "cache_key" },
      );
    if (upsertErr) {
      // Non-fatal: we still return freshly generated options.
      console.warn("generate-menus: cache upsert failed:", upsertErr.message);
    }
  }

  return jsonResponse({ options, cached: false });
});
