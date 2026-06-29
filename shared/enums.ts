import { z } from 'zod';

/**
 * Fixed code enums — single source of truth is docs/RULES.md.
 * Each enum is defined with z.enum() and the const array + TS type
 * are derived from it. Literal values are byte-for-byte identical to RULES.
 */

/** Cuisine codes — RULES R0 (한식/중식/일식/양식/외식). */
export const CuisineEnum = z.enum(['KR', 'CN', 'JP', 'WS', 'DINEOUT']);
export const CUISINES = CuisineEnum.options;
export type Cuisine = z.infer<typeof CuisineEnum>;

/** Home-only cuisine codes — RULES R2 (집밥은 DINEOUT 아님). */
export const HomeCuisineEnum = z.enum(['KR', 'CN', 'JP', 'WS']);
export const HOME_CUISINES = HomeCuisineEnum.options;
export type HomeCuisine = z.infer<typeof HomeCuisineEnum>;

/** Meal type — RULES R0 (하루 2끼: 점심/저녁). */
export const MealTypeEnum = z.enum(['lunch', 'dinner']);
export const MEAL_TYPES = MealTypeEnum.options;
export type MealType = z.infer<typeof MealTypeEnum>;

/** Ingredient category codes — RULES R4. */
export const IngredientCategoryEnum = z.enum([
  'vegetable',
  'fruit',
  'meat',
  'seafood',
  'dairy',
  'grain',
  'seasoning',
  'etc',
]);
export const INGREDIENT_CATEGORIES = IngredientCategoryEnum.options;
export type IngredientCategory = z.infer<typeof IngredientCategoryEnum>;

/** Unit codes — RULES R4 (코드 고정, 임의 환산 금지). */
export const UnitEnum = z.enum([
  'g',
  'kg',
  'ml',
  'L',
  '개',
  '장',
  '쪽',
  '대',
  '컵',
  '큰술',
  '작은술',
  '약간',
]);
export const UNITS = UnitEnum.options;
export type Unit = z.infer<typeof UnitEnum>;

/** Recipe difficulty — RULES R2. */
export const DifficultyEnum = z.enum(['easy', 'medium', 'hard']);
export const DIFFICULTIES = DifficultyEnum.options;
export type Difficulty = z.infer<typeof DifficultyEnum>;

/** Menu type discriminator — RULES R2 (집밥/외식). */
export const MenuTypeEnum = z.enum(['home', 'dineout']);
export const MENU_TYPES = MenuTypeEnum.options;
export type MenuType = z.infer<typeof MenuTypeEnum>;

/** Learning signal actions — RULES R3 (선택/좋아요/스킵/싫어요). */
export const SelectionActionEnum = z.enum(['select', 'like', 'skip', 'dislike']);
export const SELECTION_ACTIONS = SelectionActionEnum.options;
export type SelectionAction = z.infer<typeof SelectionActionEnum>;
