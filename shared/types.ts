import { z } from 'zod';
import {
  IngredientSchema,
  RecipeSchema,
  HomeMenuSchema,
  DineoutMenuSchema,
  MenuOptionSchema,
  MenuOptionArraySchema,
  MenuOptionsResponseSchema,
  PreferenceProfileSchema,
  GenerateMenusRequestSchema,
  MealEntrySchema,
  SeedMenuSchema,
  SeedPoolSchema,
} from './schema';

/**
 * TS types inferred from the zod schemas (RULES R7: 공유 타입은 스키마에서 추론).
 * Do not hand-write these — change the schema in schema.ts instead.
 */

export type Ingredient = z.infer<typeof IngredientSchema>;
export type Recipe = z.infer<typeof RecipeSchema>;
export type HomeMenu = z.infer<typeof HomeMenuSchema>;
export type DineoutMenu = z.infer<typeof DineoutMenuSchema>;
export type MenuOption = z.infer<typeof MenuOptionSchema>;
export type MenuOptionArray = z.infer<typeof MenuOptionArraySchema>;
export type MenuOptionsResponse = z.infer<typeof MenuOptionsResponseSchema>;
export type PreferenceProfile = z.infer<typeof PreferenceProfileSchema>;
export type GenerateMenusRequest = z.infer<typeof GenerateMenusRequestSchema>;
export type MealEntry = z.infer<typeof MealEntrySchema>;
export type SeedMenu = z.infer<typeof SeedMenuSchema>;
export type SeedPool = z.infer<typeof SeedPoolSchema>;

// Re-export enum types for convenience.
export type {
  Cuisine,
  HomeCuisine,
  MealType,
  IngredientCategory,
  Unit,
  Difficulty,
  MenuType,
  SelectionAction,
} from './enums';
