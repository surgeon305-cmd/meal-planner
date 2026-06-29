// =============================================================================
// UI 상수: 한국어 라벨 + Tailwind 정적 클래스 매핑.
// NOTE: Tailwind JIT는 동적 클래스명(`bg-cuisine-${code}`)을 감지하지 못하므로
// 아래처럼 완전한 클래스 문자열을 정적으로 나열한다.
// =============================================================================
import type {
  CuisineCode,
  Difficulty,
  IngredientCategory,
  MealType,
} from "./viewTypes";

export const CUISINE_LABELS: Record<CuisineCode, string> = {
  KR: "한식",
  CN: "중식",
  JP: "일식",
  WS: "양식",
  DINEOUT: "외식",
};

/** 칩 배경/글자색 (tailwind.config.js 의 cuisine.* 색상과 1:1). */
export const CUISINE_CHIP_CLASS: Record<CuisineCode, string> = {
  KR: "bg-cuisine-KR text-white",
  CN: "bg-cuisine-CN text-white",
  JP: "bg-cuisine-JP text-white",
  WS: "bg-cuisine-WS text-white",
  DINEOUT: "bg-cuisine-DINEOUT text-white",
};

/** 카드 좌측 강조 보더 색 (선택 상태 등에 사용). */
export const CUISINE_BORDER_CLASS: Record<CuisineCode, string> = {
  KR: "border-cuisine-KR",
  CN: "border-cuisine-CN",
  JP: "border-cuisine-JP",
  WS: "border-cuisine-WS",
  DINEOUT: "border-cuisine-DINEOUT",
};

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy: "쉬움",
  medium: "보통",
  hard: "어려움",
};

export const MEAL_LABELS: Record<MealType, string> = {
  lunch: "점심",
  dinner: "저녁",
};

/** 0 = 월요일. */
export const DAY_LABELS = ["월", "화", "수", "목", "금", "토", "일"] as const;

export const CATEGORY_LABELS: Record<IngredientCategory, string> = {
  vegetable: "채소",
  fruit: "과일",
  meat: "육류",
  seafood: "해산물",
  dairy: "유제품·계란",
  grain: "곡류·면·빵",
  seasoning: "양념·소스",
  etc: "기타",
};

/** 장바구니에서 카테고리를 노출하는 순서. */
export const CATEGORY_ORDER: IngredientCategory[] = [
  "vegetable",
  "fruit",
  "meat",
  "seafood",
  "dairy",
  "grain",
  "seasoning",
  "etc",
];
