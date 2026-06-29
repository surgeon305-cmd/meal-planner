import { z } from 'zod';
import {
  CuisineEnum,
  HomeCuisineEnum,
  MealTypeEnum,
  IngredientCategoryEnum,
  UnitEnum,
  DifficultyEnum,
} from './enums';

/**
 * Zod schemas — single source of truth is docs/RULES.md.
 * The menu schemas mirror the Claude output contract (R2) exactly.
 */

/** Ingredient — RULES R2 / R4. quantity scales by servings (R5), `약간` excepted. */
export const IngredientSchema = z.object({
  /** 정규화 이전의 자연어 이름이어도 됨 (정규화는 R4 담당). */
  name: z.string().min(1),
  quantity: z.number(),
  unit: UnitEnum,
  category: IngredientCategoryEnum,
  /** 기본 양념류 여부 (소금/간장/기름 등 true) — RULES R4. */
  pantryStaple: z.boolean(),
});

/** Recipe block (집밥 only) — RULES R2. */
export const RecipeSchema = z.object({
  steps: z.array(z.string()),
  tips: z.array(z.string()),
});

/** Home menu (집밥, type:"home") — RULES R2. cuisine은 KR|CN|JP|WS만. */
export const HomeMenuSchema = z.object({
  /** 백엔드에서 부여 (Claude는 비워도 됨) — RULES R2. */
  id: z.string().optional(),
  name: z.string().min(1),
  cuisine: HomeCuisineEnum,
  type: z.literal('home'),
  description: z.string(),
  difficulty: DifficultyEnum,
  cookTimeMin: z.number().int().nonnegative(),
  /** 기본 인분 (설정값과 일치) — RULES R2 / R5. */
  servings: z.number().int().positive(),
  /** 1인분 기준 추정 칼로리 — RULES R2. */
  estimatedCalories: z.number().nonnegative(),
  tags: z.array(z.string()),
  recipe: RecipeSchema,
  ingredients: z.array(IngredientSchema),
});

/** Dineout menu (외식, type:"dineout") — RULES R2. 레시피/재료 없음. */
export const DineoutMenuSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  cuisine: z.literal('DINEOUT'),
  type: z.literal('dineout'),
  description: z.string(),
  tags: z.array(z.string()),
  /** 외부 검색용 키워드 — RULES R2. */
  searchKeyword: z.string(),
});

/** One menu option — RULES R2, discriminated union on "type". */
export const MenuOptionSchema = z.discriminatedUnion('type', [
  HomeMenuSchema,
  DineoutMenuSchema,
]);

/** Lenient array of menu options — for partial / refresh use. */
export const MenuOptionArraySchema = z.array(MenuOptionSchema);

/**
 * Full Claude response — RULES R1/R2: 슬롯당 항상 정확히 5선지.
 * 백엔드는 이 스키마로 검증하고 실패 시 1회 재요청 (R6).
 */
export const MenuOptionsResponseSchema = z.array(MenuOptionSchema).length(5);

/** Preference profile (사용자별 취향) — RULES R3. */
export const PreferenceProfileSchema = z.object({
  /** cuisine 단위 누적 가중치 — RULES R3. */
  cuisineWeights: z.record(CuisineEnum, z.number()),
  /** tag 단위 누적 가중치 — RULES R3. */
  tagWeights: z.record(z.string(), z.number()),
  /** dislike한 재료 — 하드 필터 (RULES R3). */
  dislikedIngredients: z.array(z.string()),
  /** dislike한 메뉴명 — 차단 (RULES R3). */
  dislikedMenuNames: z.array(z.string()),
  /** 알레르기 — 항상 하드 필터 (RULES R3). */
  allergies: z.array(z.string()),
  /** 마지막 선택 인분 수, 없으면 null — RULES R5. */
  lastServings: z.number().int().positive().nullable(),
});

/** 저장된 한 끼 (날짜+끼니 확정 엔트리) — RULES R8. */
export const MealEntrySchema = z.object({
  id: z.string().optional(),
  userId: z.string().optional(),
  /** ISO YYYY-MM-DD — RULES R8-2. */
  entryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  meal: MealTypeEnum,
  /** 시드 슬러그(R9) 또는 생성 id. */
  menuId: z.string().min(1),
  cuisine: CuisineEnum,
  /** 확정 시점의 메뉴 스냅샷 — RULES R2/R8-3. */
  menu: MenuOptionSchema,
  servings: z.number().int().positive().nullable().optional(),
});

/** 시드 레시피 한 개 — RULES R9. MenuOption과 동일하되 id 필수(안정 슬러그). */
export const SeedMenuSchema = z.discriminatedUnion('type', [
  HomeMenuSchema.extend({ id: z.string().min(1) }),
  DineoutMenuSchema.extend({ id: z.string().min(1) }),
]);

/** 시드 풀 전체 — RULES R9. */
export const SeedPoolSchema = z.array(SeedMenuSchema);

/** Edge Function request payload — RULES R0/R1/R6. */
export const GenerateMenusRequestSchema = z.object({
  /** 0~6 (0 = 월요일) — RULES R0. */
  dayIndex: z.number().int().min(0).max(6),
  meal: MealTypeEnum,
  /** 쿨다운 등으로 제외할 요리종류 — RULES R1-4. */
  excludedCuisines: z.array(CuisineEnum),
  servings: z.number().int().positive(),
  /** 항상 하드 필터 — RULES R3. */
  allergies: z.array(z.string()),
  /** 항상 하드 필터 — RULES R3. */
  dislikedIngredients: z.array(z.string()),
  /** 갱신 시 직전 선지 재등장 방지 — RULES R1-5. */
  excludedMenuNames: z.array(z.string()),
  /** 취향 가중치 힌트 (정규화된 버킷 등) — RULES R3, optional. */
  preferenceHints: z.record(z.string(), z.unknown()).optional(),
  /** 갱신 여부 — RULES R1-5. */
  isRefresh: z.boolean(),
});
