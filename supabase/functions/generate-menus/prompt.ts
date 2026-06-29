// keep in sync with prompts/system-prompt.md (RULES R6-5)
//
// This module reproduces the canonical system prompt that the `prompts/`
// team authors in prompts/system-prompt.md. The markdown there is the
// human-readable source of truth; this file is the machine copy that the
// Edge Function actually sends to Claude. When prompts/system-prompt.md
// changes, update this file (and bump the version note in RULES.md per R6-5).

/** Request shape — mirrors GenerateMenusRequestSchema in shared/schema.ts (RULES R0/R1/R6). */
export interface GenerateMenusRequest {
  /** 0~6 (0 = Monday) — RULES R0. */
  dayIndex: number;
  /** "lunch" | "dinner" — RULES R0. */
  meal: "lunch" | "dinner";
  /** Cuisines to exclude (cooldown etc.) — RULES R1-4. */
  excludedCuisines: string[];
  /** Servings selected by the user — RULES R5. */
  servings: number;
  /** Always hard-filtered — RULES R3. */
  allergies: string[];
  /** Always hard-filtered — RULES R3. */
  dislikedIngredients: string[];
  /** On refresh, previously shown menu names to avoid repeating — RULES R1-5. */
  excludedMenuNames: string[];
  /** Optional preference weighting hints — RULES R3. */
  preferenceHints?: Record<string, unknown>;
  /** Refresh flag — RULES R1-5. */
  isRefresh: boolean;
}

/** Single-menu request shape (search & add) — RULES R2/R6. */
export interface GenerateSingleRequest {
  mode: "single";
  /** The dish the user typed (Korean). */
  requestedName: string;
  /** "lunch" | "dinner" — RULES R0. */
  meal: "lunch" | "dinner";
  /** Optional cuisine nudge (KR/CN/JP/WS/DINEOUT or free text). */
  cuisineHint?: string;
}

const MEAL_LABEL: Record<string, string> = {
  lunch: "점심",
  dinner: "저녁",
};

const CUISINE_LABEL: Record<string, string> = {
  KR: "한식",
  CN: "중식",
  JP: "일식",
  WS: "양식",
  DINEOUT: "외식",
};

const DAY_LABEL = ["월", "화", "수", "목", "금", "토", "일"];

/**
 * System prompt — bakes RULES R0/R1/R2 in for consistency (RULES R6-4).
 * Output is ONLY a JSON array of 5 menu options, no prose, no code fences.
 */
export function buildSystemPrompt(): string {
  return [
    "당신은 한국 가정의 주간 식단을 짜 주는 메뉴 추천 엔진이다.",
    "한 끼니 슬롯에 대해 **정확히 5개**의 메뉴 선지를 생성한다.",
    "",
    "## 구성 규칙 (RULES R1)",
    "1. 선지는 항상 5개: **집밥 4개 + 외식 1개**.",
    "2. 요리종류(cuisine) 코드는 다음 5개만 사용한다: KR(한식), CN(중식), JP(일식), WS(양식), DINEOUT(외식).",
    "   - 집밥(type:\"home\")의 cuisine 은 KR|CN|JP|WS 중 하나. 절대 DINEOUT 아님.",
    "   - 외식(type:\"dineout\")의 cuisine 은 반드시 DINEOUT.",
    "3. 5개 선지의 요리종류는 **최대한 다양**하게 한다. 한·중·일·양이 매번 다 있을 필요는 없으나,",
    "   **같은 요리종류가 5선지 안에서 2개를 넘지 않게** 한다 (DINEOUT 1개 포함).",
    "4. 5개 중 **1개는 탐색용 와일드카드 선지**로 둔다 (평소와 다른 의외의 선택지). 필터버블 방지(RULES R1-6).",
    "5. 모든 집밥 레시피는 **한국 가정에서 만들 수 있는 한국어 레시피**로 작성한다.",
    "",
    "## 출력 계약 (RULES R2)",
    "오직 **JSON 배열만** 출력한다. 설명 문장, 코드펜스(```), 머리말 금지.",
    "배열 길이는 정확히 5.",
    "",
    "집밥 항목(type:\"home\") 필드:",
    '{ "name", "cuisine"(KR|CN|JP|WS), "type":"home", "description", "difficulty"(easy|medium|hard),',
    '  "cookTimeMin"(number), "servings"(number), "estimatedCalories"(1인분 기준 number), "tags"(string[]),',
    '  "recipe": { "steps"(string[]), "tips"(string[]) },',
    '  "ingredients": [ { "name", "quantity"(number), "unit", "category", "pantryStaple"(boolean) } ] }',
    "",
    "외식 항목(type:\"dineout\") 필드 (레시피/재료 없음):",
    '{ "name", "cuisine":"DINEOUT", "type":"dineout", "description", "tags"(string[]), "searchKeyword" }',
    "",
    "단위(unit) 코드: g, kg, ml, L, 개, 장, 쪽, 대, 컵, 큰술, 작은술, 약간.",
    "카테고리(category) 코드: vegetable, fruit, meat, seafood, dairy, grain, seasoning, etc.",
    "소금·설탕·간장·식용유·후추·다진마늘 등 기본 양념은 pantryStaple:true 로 표기한다.",
    "id 필드는 비워도 된다 (백엔드가 부여).",
  ].join("\n");
}

/**
 * User prompt — encodes this specific slot's constraints (RULES R1-4, R3, R5).
 */
export function buildUserPrompt(req: GenerateMenusRequest): string {
  const dayLabel = DAY_LABEL[req.dayIndex] ?? String(req.dayIndex);
  const mealLabel = MEAL_LABEL[req.meal] ?? req.meal;

  const excludedCuisineLabels = req.excludedCuisines
    .map((c) => `${c}(${CUISINE_LABEL[c] ?? c})`)
    .join(", ");

  const lines: string[] = [
    `슬롯: ${dayLabel}요일 ${mealLabel} (dayIndex=${req.dayIndex}, meal=${req.meal}).`,
    `인분 수(servings): ${req.servings}. 모든 집밥 항목의 servings 와 재료 수량을 이 값에 맞춘다 (RULES R5).`,
  ];

  if (req.excludedCuisines.length > 0) {
    lines.push(
      `제외할 요리종류 (쿨다운, RULES R1-4): ${excludedCuisineLabels}. 이 cuisine 들은 집밥 선지에서 사용하지 않는다.`,
    );
  } else {
    lines.push("이번 슬롯에는 쿨다운으로 제외할 요리종류가 없다.");
  }

  if (req.allergies.length > 0) {
    lines.push(
      `알레르기 (항상 하드 필터, 절대 사용 금지, RULES R3): ${req.allergies.join(", ")}.`,
    );
  }

  if (req.dislikedIngredients.length > 0) {
    lines.push(
      `비선호 재료 (항상 하드 필터, 절대 사용 금지, RULES R3): ${req.dislikedIngredients.join(", ")}.`,
    );
  }

  if (req.isRefresh && req.excludedMenuNames.length > 0) {
    lines.push(
      `갱신(refresh) 요청 (RULES R1-5): 아래 메뉴명은 직전에 이미 보여줬으니 **다시 제시하지 말 것**: ${req.excludedMenuNames.join(", ")}.`,
    );
  } else if (req.isRefresh) {
    lines.push("갱신(refresh) 요청: 새로운 5선지를 생성한다.");
  }

  if (req.preferenceHints && Object.keys(req.preferenceHints).length > 0) {
    lines.push(
      `취향 힌트 (부드러운 편향만, 완전 고정 금지 — 와일드카드 1선지는 유지, RULES R3/R1-6): ${JSON.stringify(req.preferenceHints)}.`,
    );
  }

  lines.push(
    "위 제약을 모두 지켜 정확히 5개의 메뉴 선지를 JSON 배열로만 출력한다 (집밥 4 + 외식 1).",
  );

  return lines.join("\n");
}

/**
 * System prompt for SINGLE-menu mode (search & add).
 * Output is ONLY one JSON object (no array, no prose, no code fences),
 * conforming to RULES R2.
 */
export function buildSingleSystemPrompt(): string {
  return [
    "당신은 한국 가정 식단을 위한 메뉴 데이터 생성기다.",
    "사용자가 입력한 **하나의 메뉴**에 대해, RULES R2 스키마를 따르는 **메뉴 객체 1개**를 생성한다.",
    "",
    "## 출력 계약 (RULES R2)",
    "오직 **JSON 객체 1개만** 출력한다. 배열 금지, 설명 문장 금지, 코드펜스(```) 금지, 머리말 금지.",
    "",
    "집을 만들어 먹는 요리면 type:\"home\":",
    '{ "name", "cuisine"(KR|CN|JP|WS), "type":"home", "description", "difficulty"(easy|medium|hard),',
    '  "cookTimeMin"(number), "servings"(number), "estimatedCalories"(1인분 기준 number), "tags"(string[]),',
    '  "recipe": { "steps"(string[]), "tips"(string[]) },',
    '  "ingredients": [ { "name", "quantity"(number), "unit", "category", "pantryStaple"(boolean) } ] }',
    "",
    "주로 사 먹는(외식) 메뉴면 type:\"dineout\" (레시피/재료 없음):",
    '{ "name", "cuisine":"DINEOUT", "type":"dineout", "description", "tags"(string[]), "searchKeyword" }',
    "",
    "규칙:",
    "- 집밥의 cuisine 은 KR|CN|JP|WS 중 하나(절대 DINEOUT 아님), 외식의 cuisine 은 반드시 DINEOUT.",
    "- 모든 텍스트(이름·설명·레시피·재료명)는 **한국어**.",
    "- 단위(unit): g, kg, ml, L, 개, 장, 쪽, 대, 컵, 큰술, 작은술, 약간.",
    "- 카테고리(category): vegetable, fruit, meat, seafood, dairy, grain, seasoning, etc.",
    "- 소금·설탕·간장·식용유·후추·다진마늘 등 기본 양념은 pantryStaple:true.",
    "- id 필드는 비워도 된다(백엔드가 부여).",
  ].join("\n");
}

/** User prompt for SINGLE-menu mode — encodes the requested name + context. */
export function buildSingleUserPrompt(req: GenerateSingleRequest): string {
  const mealLabel = MEAL_LABEL[req.meal] ?? req.meal;
  const lines: string[] = [
    `사용자가 요청한 메뉴 이름: "${req.requestedName}".`,
    `끼니: ${mealLabel}.`,
    "이 메뉴와 가장 잘 맞는 **메뉴 객체 1개**를 생성한다. name 은 요청한 이름을 최대한 그대로 사용한다.",
    "집에서 조리하는 요리면 type:\"home\"(레시피+재료 포함), 주로 사 먹는 메뉴면 type:\"dineout\".",
  ];
  if (req.cuisineHint) {
    lines.push(
      `요리종류 힌트: ${req.cuisineHint} (적절하면 반영, 메뉴와 맞지 않으면 무시).`,
    );
  }
  lines.push("RULES R2 스키마를 지켜 JSON 객체 1개만 출력한다.");
  return lines.join("\n");
}
