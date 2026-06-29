// =============================================================================
// AI menu generation client (RULES R2/R6).
// -----------------------------------------------------------------------------
// Thin client over the `generate-menus` Supabase Edge Function's single-menu
// mode. The Claude API key stays server-side (RULES R6-1); this module only
// invokes the function, then validates the returned object against the R2
// menu shape before handing it to the UI.
//
// The seed-pool search path (MenuSearchModal) does NOT depend on this module,
// so the app degrades gracefully when the Edge Function is not deployed.
// =============================================================================
import { SeedMenuSchema } from "@shared/schema";
import type { MealType, SeedMenu } from "@shared/types";
import { supabase } from "./supabaseClient";

export interface GenerateOneOptions {
  /** Slot meal — forwarded to the prompt for context (RULES R0). */
  meal: MealType;
  /** Optional cuisine nudge (KR/CN/JP/WS/DINEOUT or free text). */
  cuisineHint?: string;
}

/** Discriminated result — either a validated menu or a user-facing error. */
export type GenerateOneResult = { menu: SeedMenu } | { error: string };

/**
 * Stable id for a generated (non-seed) menu — `ai-<kebab(name)>`.
 * Keeps Unicode letters/digits (Korean names stay legible), collapses the
 * rest into single dashes. Falls back to "menu" if nothing survives.
 */
function kebabId(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
  return `ai-${slug || "menu"}`;
}

/** Best-effort extraction of a server error message from a non-2xx invoke. */
async function readInvokeError(error: unknown): Promise<string> {
  const ctx = (error as { context?: unknown } | null)?.context;
  if (ctx && typeof (ctx as Response).json === "function") {
    try {
      const body: unknown = await (ctx as Response).json();
      const msg = (body as { error?: unknown } | null)?.error;
      if (typeof msg === "string" && msg.length > 0) return msg;
    } catch {
      // ignore — fall through to the generic message
    }
  }
  return "AI 메뉴 생성을 사용할 수 없습니다. 잠시 후 다시 시도하거나 서버 설정을 확인하세요.";
}

/**
 * Ask the Edge Function (single-menu mode) for ONE menu matching `name`,
 * validate it against R2 (SeedMenuSchema), and stamp a stable id.
 */
export async function generateOneMenu(
  name: string,
  opts: GenerateOneOptions,
): Promise<GenerateOneResult> {
  const requestedName = name.trim();
  if (!requestedName) return { error: "메뉴 이름을 입력하세요." };

  let data: unknown;
  try {
    const res = await supabase.functions.invoke("generate-menus", {
      body: {
        mode: "single",
        requestedName,
        meal: opts.meal,
        cuisineHint: opts.cuisineHint,
      },
    });
    if (res.error) return { error: await readInvokeError(res.error) };
    data = res.data;
  } catch {
    return {
      error: "AI 서버에 연결하지 못했습니다. 네트워크 상태를 확인해 주세요.",
    };
  }

  const raw = (data as { menu?: unknown } | null)?.menu;
  if (raw === undefined || raw === null) {
    const serverError = (data as { error?: unknown } | null)?.error;
    return {
      error: typeof serverError === "string"
        ? serverError
        : "AI 응답을 받지 못했습니다.",
    };
  }

  // Stamp the stable id (RULES R9 ids are non-empty) before validation.
  const candidate = typeof raw === "object"
    ? { ...(raw as Record<string, unknown>), id: kebabId(requestedName) }
    : raw;

  const parsed = SeedMenuSchema.safeParse(candidate);
  if (!parsed.success) {
    return { error: "생성된 메뉴가 형식 검증(R2)에 실패했습니다." };
  }
  return { menu: parsed.data };
}
