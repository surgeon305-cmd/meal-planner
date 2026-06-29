// =============================================================================
// PLACEHOLDER VIEW-MODEL TYPES
// -----------------------------------------------------------------------------
// These mirror RULES.md R0/R2/R4 so the UI can be built before the real shared
// schema exists. In Phase 1 these will be replaced by imports from "@shared/*"
// (zod-inferred types) and the data will arrive via React Query, not mockData.
// Keep enum string values 1:1 with RULES R0/R4.
// =============================================================================

/** RULES R0 — 요리종류(cuisine) 코드 (고정 5개). */
export type CuisineCode = "KR" | "CN" | "JP" | "WS" | "DINEOUT";

/** 집밥 선지에 허용되는 cuisine (DINEOUT 제외). */
export type HomeCuisineCode = Exclude<CuisineCode, "DINEOUT">;

/** RULES R0 — 끼니. */
export type MealType = "lunch" | "dinner";

/** RULES R2 — 난이도. */
export type Difficulty = "easy" | "medium" | "hard";

/** RULES R4 — 재료 카테고리 코드 (고정). */
export type IngredientCategory =
  | "vegetable"
  | "fruit"
  | "meat"
  | "seafood"
  | "dairy"
  | "grain"
  | "seasoning"
  | "etc";

/** RULES R4 — 단위 코드 (고정). */
export type Unit =
  | "g"
  | "kg"
  | "ml"
  | "L"
  | "개"
  | "장"
  | "쪽"
  | "대"
  | "컵"
  | "큰술"
  | "작은술"
  | "약간";

/** RULES R2/R4 — 재료 한 항목. */
export interface Ingredient {
  name: string;
  quantity: number;
  unit: Unit;
  category: IngredientCategory;
  /** 기본 양념류 여부 (소금/간장/기름 등). */
  pantryStaple: boolean;
}

/** RULES R2 — 레시피 (집밥 전용). */
export interface Recipe {
  steps: string[];
  tips: string[];
}

/**
 * RULES R2 — 집밥 메뉴 선지.
 * NOTE: 실제 스키마에선 Claude 출력 시 id가 비어있을 수 있으나, UI 라우팅을 위해
 * 항상 채워진 id를 가정한다 (백엔드가 부여).
 */
export interface HomeMenuOption {
  id: string;
  name: string;
  cuisine: HomeCuisineCode;
  type: "home";
  description: string;
  difficulty: Difficulty;
  cookTimeMin: number;
  servings: number;
  estimatedCalories: number;
  tags: string[];
  recipe: Recipe;
  ingredients: Ingredient[];
}

/** RULES R2 — 외식 메뉴 선지 (레시피/재료 없음). */
export interface DineoutMenuOption {
  id: string;
  name: string;
  cuisine: "DINEOUT";
  type: "dineout";
  description: string;
  tags: string[];
  /** 외부 검색용 키워드. */
  searchKeyword: string;
}

/** RULES R2 — 한 선지(option)는 집밥 또는 외식. */
export type MenuOption = HomeMenuOption | DineoutMenuOption;

/** 타입 가드: 집밥 메뉴인지. */
export function isHomeMenu(menu: MenuOption): menu is HomeMenuOption {
  return menu.type === "home";
}

/**
 * 한 슬롯(요일×끼니). 갱신(refresh)을 모킹하기 위해 여러 벌의 5선지 세트를 갖는다.
 * 실제 구현에선 슬롯당 현재 5선지 + 갱신 시 서버에서 새 세트를 받아온다.
 */
export interface MealSlot {
  dayIndex: number; // 0 = 월요일
  meal: MealType;
  /** 각 원소가 정확히 5개의 선지로 구성된 한 벌. RULES R1: 집밥 4 + 외식 1. */
  optionSets: MenuOption[][];
}

/** 한 주(7일 × 2끼 = 14슬롯). */
export interface WeekPlan {
  weekStart: string; // ISO date (월요일)
  slots: MealSlot[];
}

/** 장바구니 합산 항목 (RULES R4). */
export interface CartItem {
  name: string;
  quantity: number;
  unit: Unit;
  category: IngredientCategory;
  pantryStaple: boolean;
}
