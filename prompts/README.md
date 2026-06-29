# Prompts

Claude prompt files for the meal-planning PWA. These drive menu generation in
the `generate-menus` Supabase Edge Function (RULES R6-1).

## Files
- `system-prompt.md` — system prompt for menu generation (embeds R0/R1/R2 rules
  and the exact R2 output schema, per RULES R6-4).
- `generate-menus.user.md` — user-message template with `{{placeholders}}`.

## Versioning (RULES R6-5)

Prompts are **version-controlled**. Any change to a prompt file MUST:
1. First update `docs/RULES.md` if the underlying rule changed (RULES R7: rules
   change before code/prompts — never the reverse).
2. Bump the version and **record the reason** in the changelog below.
3. Keep all literal enum values (cuisine codes, R4 categories/units) and the R2
   JSON schema **exactly** in sync with `docs/RULES.md`.

The default model is `claude-opus-4-8` (RULES R6-4).

## Changelog

| Version | Date | Author | Reason / change |
|---|---|---|---|
| v1 | 2026-06-29 | surgeon305@gmail.com | Initial prompts: `system-prompt.md` and `generate-menus.user.md`. Encodes R0/R1/R2 (5 options = 4 home + 1 dineout, max 2 per cuisine, 1 wildcard, cooldown/refresh/allergy hard filters) and the exact R2 output schema. |
