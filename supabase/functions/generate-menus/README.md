# generate-menus (Supabase Edge Function)

Generates exactly **5 menu options** for one meal slot (집밥 4 + 외식 1) by
calling the Claude API, validating the output against the RULES R2 schema, and
caching the result. Implements PLAN section 4 and RULES R6.

## Required secrets

Set these in the Supabase dashboard (**Edge Functions → Secrets**) — they are
**server-side only** and must never reach the browser (RULES R6-1):

| Secret | Purpose |
|---|---|
| `ANTHROPIC_API_KEY` | Claude API key (`x-api-key`). |
| `SUPABASE_URL` | Project URL (injected by Supabase, but read from env here). |
| `SUPABASE_SERVICE_ROLE_KEY` | Service-role key for `menu_cache` read/write. |

```bash
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
# SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided automatically in the
# Edge runtime, but set them explicitly if you run locally.
```

## Request body (`POST`)

Matches `GenerateMenusRequestSchema` in `shared/schema.ts`:

```jsonc
{
  "dayIndex": 0,                 // 0..6 (0 = Monday)
  "meal": "lunch",              // "lunch" | "dinner"
  "excludedCuisines": ["JP"],   // RULES R1-4 cooldown
  "servings": 2,
  "allergies": ["새우"],         // always hard-filtered (R3)
  "dislikedIngredients": ["오이"],
  "excludedMenuNames": [],       // refresh: previously shown names (R1-5)
  "preferenceHints": {},         // optional (R3)
  "isRefresh": false
}
```

## Response

```jsonc
{ "options": [ /* 5 menu options, RULES R2 */ ], "cached": true | false }
```

Errors: `400` (bad request), `405` (non-POST), `500` (missing secrets),
`502` (Claude failed validation after 1 retry — RULES R6-3).

## Behaviour (RULES R6)

1. **Cache-first** (non-refresh): looks up `menu_cache` by a constraint key
   `{dayIndex, meal, sorted excludedCuisines, servings}`; on hit, returns the
   cached payload and increments `hit_count`.
2. **Generate** on miss or `isRefresh`: builds prompts (`prompt.ts`), calls
   `claude-opus-4-8` (`max_tokens` 4096), validates the JSON array (length 5 +
   R2 fields), **retries once** on failure, then upserts into `menu_cache`
   (non-refresh path only).

## Deploy

```bash
supabase functions deploy generate-menus
```

## Cross-team alignment

- **prompts team:** `prompt.ts` carries a machine copy of
  `prompts/system-prompt.md`. Keep them in sync (RULES R6-5); the file is marked
  `// keep in sync with prompts/system-prompt.md`.
- **db team:** this function expects a `menu_cache` table — see below.

### `menu_cache` columns expected by this function

| Column | Type | Notes |
|---|---|---|
| `cache_key` | `text` | **unique** (upsert `onConflict`). |
| `day_index` | `int2` | |
| `meal` | `text` | `lunch` / `dinner`. |
| `excluded_cuisines` | `text[]` | sorted. |
| `servings` | `int2` | |
| `payload` | `jsonb` | the 5-option array (RULES R2). |
| `hit_count` | `int4` | default `0`. |
