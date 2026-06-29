# User Message Template — generate-menus (v1)

> Source of truth: `docs/RULES.md`. Pair with `prompts/system-prompt.md`.
> The backend fills the `{{placeholders}}` before sending this as the user turn.

---

## Template

```
Generate the 5 menu options for this slot.

Slot:
- dayIndex: {{dayIndex}}            # 0~6, 0 = Monday (RULES R0)
- day: {{dayName}}                  # 요일, e.g. 월요일
- meal: {{meal}}                    # 점심 or 저녁 (RULES R0: lunch/dinner)

Constraints:
- excludedCuisines: {{excludedCuisines}}     # cooldown — never produce these (RULES R1-4)
- servings: {{servings}}                      # scale ingredient quantities to this (RULES R5)
- allergies: {{allergies}}                    # HARD filter, never include (RULES R3)
- dislikedIngredients: {{dislikedIngredients}} # HARD filter, never include (RULES R3)
- excludedMenuNames: {{excludedMenuNames}}    # never repeat these names (RULES R1-5)
- preferenceHints: {{preferenceHints}}        # soft bias only (RULES R1-6, R3)
- isRefresh: {{isRefresh}}                     # true if this is a refresh of the slot (RULES R1-5)

Produce exactly 5 options (4 home + 1 dineout), with exactly 1 wildcard,
no cuisine more than twice. Output ONLY the JSON array per the schema. No prose.
```

---

## Placeholder → rule mapping

| Placeholder | Type / example | Maps to | Behavior |
|---|---|---|---|
| `{{dayIndex}}` | int 0–6, e.g. `2` | R0 | Slot's day. 0 = Monday. |
| `{{dayName}}` | 요일 string, e.g. `수요일` | R0 | Human-readable day for context. |
| `{{meal}}` | `점심` or `저녁` | R0 | Which meal (lunch/dinner). |
| `{{excludedCuisines}}` | array of codes, e.g. `["JP","KR"]` | R1-4 | **Hard** — never output any option with these `cuisine` values. Never contains `DINEOUT`. Empty `[]` = no cooldown. |
| `{{servings}}` | int, e.g. `2` | R2, R5 | Set each home option's `servings`; scale ingredient quantities. `약간`/`pantryStaple` not scaled. |
| `{{allergies}}` | array, e.g. `["새우","땅콩"]` | R3 | **Hard** filter — never include in any ingredients or dineout suggestion. |
| `{{dislikedIngredients}}` | array, e.g. `["오이","고수"]` | R3 | **Hard** filter — never include. |
| `{{excludedMenuNames}}` | array, e.g. `["제육볶음","김치찌개"]` | R1-5 | **Hard** — none of the 5 output names may match. Mainly used on refresh. |
| `{{preferenceHints}}` | object/array of cuisine+tag weights, e.g. `{"KR":+8,"매콤":+5}` | R1-6, R3 | **Soft** bias toward favored cuisines/tags. Not a lock. |
| `{{isRefresh}}` | `true`/`false` | R1-5 | When `true`, this is a re-roll of the same slot; `excludedMenuNames` carries the previously shown names that must not reappear. |

## Notes
- Arrays may be empty (`[]`); treat empty as "no constraint of that kind."
- Regardless of inputs, the system-prompt invariants always hold: exactly 5
  options, 4 home + 1 dineout, exactly 1 wildcard, no cuisine more than twice,
  JSON-array-only output.
