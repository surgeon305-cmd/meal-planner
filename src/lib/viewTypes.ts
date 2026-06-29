// =============================================================================
// VIEW-MODEL TYPES — now backed by the shared zod-inferred types (@shared/types).
// -----------------------------------------------------------------------------
// Phase 0 used hand-written placeholders here. They are replaced by re-exports of
// the single source of truth (RULES R7). UI keeps using these names for
// continuity; `CuisineCode`/`HomeCuisineCode` are aliases of shared enums.
// =============================================================================
import type { Cuisine, HomeCuisine } from "@shared/types";

export type {
  MealType,
  Difficulty,
  IngredientCategory,
  Unit,
  Ingredient,
  Recipe,
  MenuOption,
  SeedMenu,
} from "@shared/types";

/** RULES R0 — 요리종류(cuisine) 코드. shared `Cuisine`의 레거시 별칭. */
export type CuisineCode = Cuisine;

/** 집밥 선지에 허용되는 cuisine (DINEOUT 제외). shared `HomeCuisine` 별칭. */
export type HomeCuisineCode = HomeCuisine;

/**
 * 타입 가드: 집밥(home) 메뉴인지. `MenuOption`과 `SeedMenu` 모두에 동작하도록
 * 제네릭으로 둔다 (둘 다 type 디스크리미네이터를 가짐).
 */
export function isHomeMenu<T extends { type: string }>(
  menu: T,
): menu is Extract<T, { type: "home" }> {
  return menu.type === "home";
}
