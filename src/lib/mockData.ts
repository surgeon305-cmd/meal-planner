// =============================================================================
// PLACEHOLDER MOCK DATA
// -----------------------------------------------------------------------------
// 한국어 샘플 데이터. UI를 백엔드 없이 개발/시연하기 위한 임시 데이터다.
// Phase 1에서 이 파일의 export들은 @shared 타입 + React Query 훅
// (예: useWeekPlan, useMenu, useCart)로 대체된다.
// RULES R1(집밥4+외식1), R2(스키마), R4(카테고리/단위/기본양념) 준수.
// =============================================================================
import type {
  CartItem,
  DineoutMenuOption,
  HomeMenuOption,
  MenuOption,
  WeekPlan,
} from "./viewTypes";
import { isHomeMenu } from "./viewTypes";

// ----------------------------------------------------------------------------
// 집밥 메뉴 풀
// ----------------------------------------------------------------------------
const jeyuk: HomeMenuOption = {
  id: "kr-jeyuk",
  name: "제육볶음",
  cuisine: "KR",
  type: "home",
  description: "매콤달콤 밥도둑 돼지고기 볶음",
  difficulty: "easy",
  cookTimeMin: 25,
  servings: 2,
  estimatedCalories: 650,
  tags: ["매콤", "돼지고기", "볶음"],
  recipe: {
    steps: [
      "1. 돼지고기를 한입 크기로 썰고 양파·대파를 채 썬다.",
      "2. 고추장·간장·다진마늘·설탕으로 양념장을 만든다.",
      "3. 달군 팬에 식용유를 두르고 돼지고기를 볶는다.",
      "4. 고기가 익으면 양념장과 채소를 넣고 센 불에 볶는다.",
      "5. 대파를 넣고 한 번 더 볶아 마무리한다.",
    ],
    tips: ["센 불에서 빠르게 볶아야 고기가 질겨지지 않는다.", "마지막에 참기름 한 방울이 풍미를 더한다."],
  },
  ingredients: [
    { name: "돼지고기 앞다리살", quantity: 300, unit: "g", category: "meat", pantryStaple: false },
    { name: "양파", quantity: 1, unit: "개", category: "vegetable", pantryStaple: false },
    { name: "대파", quantity: 1, unit: "대", category: "vegetable", pantryStaple: false },
    { name: "고추장", quantity: 2, unit: "큰술", category: "seasoning", pantryStaple: true },
    { name: "간장", quantity: 1, unit: "큰술", category: "seasoning", pantryStaple: true },
    { name: "다진마늘", quantity: 1, unit: "큰술", category: "seasoning", pantryStaple: true },
    { name: "식용유", quantity: 1, unit: "큰술", category: "seasoning", pantryStaple: true },
  ],
};

const kimchiJjigae: HomeMenuOption = {
  id: "kr-kimchijjigae",
  name: "김치찌개",
  cuisine: "KR",
  type: "home",
  description: "푹 익은 김치로 끓인 얼큰한 찌개",
  difficulty: "easy",
  cookTimeMin: 30,
  servings: 2,
  estimatedCalories: 480,
  tags: ["얼큰", "김치", "찌개"],
  recipe: {
    steps: [
      "1. 김치를 적당히 썰고 돼지고기는 한입 크기로 준비한다.",
      "2. 냄비에 돼지고기를 볶다가 김치를 넣고 함께 볶는다.",
      "3. 물을 붓고 고춧가루·간장으로 간한다.",
      "4. 끓으면 두부와 대파를 넣고 15분 더 끓인다.",
    ],
    tips: ["김치가 신김치일수록 맛이 깊다.", "설탕 약간으로 신맛을 잡을 수 있다."],
  },
  ingredients: [
    { name: "신김치", quantity: 300, unit: "g", category: "vegetable", pantryStaple: false },
    { name: "돼지고기 목살", quantity: 200, unit: "g", category: "meat", pantryStaple: false },
    { name: "두부", quantity: 200, unit: "g", category: "etc", pantryStaple: false },
    { name: "대파", quantity: 1, unit: "대", category: "vegetable", pantryStaple: false },
    { name: "고춧가루", quantity: 1, unit: "큰술", category: "seasoning", pantryStaple: true },
    { name: "간장", quantity: 1, unit: "큰술", category: "seasoning", pantryStaple: true },
  ],
};

const doenjangJjigae: HomeMenuOption = {
  id: "kr-doenjang",
  name: "된장찌개",
  cuisine: "KR",
  type: "home",
  description: "구수한 된장에 채소 듬뿍",
  difficulty: "easy",
  cookTimeMin: 25,
  servings: 2,
  estimatedCalories: 320,
  tags: ["구수", "된장", "찌개"],
  recipe: {
    steps: [
      "1. 멸치육수를 내거나 물을 끓인다.",
      "2. 된장을 풀고 애호박·양파·표고버섯을 넣는다.",
      "3. 한소끔 끓으면 두부와 대파를 넣는다.",
      "4. 5분 더 끓여 마무리한다.",
    ],
    tips: ["된장은 끓기 전에 풀어야 잘 어우러진다."],
  },
  ingredients: [
    { name: "된장", quantity: 2, unit: "큰술", category: "seasoning", pantryStaple: true },
    { name: "두부", quantity: 200, unit: "g", category: "etc", pantryStaple: false },
    { name: "애호박", quantity: 1, unit: "개", category: "vegetable", pantryStaple: false },
    { name: "양파", quantity: 1, unit: "개", category: "vegetable", pantryStaple: false },
    { name: "표고버섯", quantity: 2, unit: "개", category: "vegetable", pantryStaple: false },
    { name: "대파", quantity: 1, unit: "대", category: "vegetable", pantryStaple: false },
  ],
};

const bibimbap: HomeMenuOption = {
  id: "kr-bibimbap",
  name: "비빔밥",
  cuisine: "KR",
  type: "home",
  description: "각종 나물과 고추장으로 비벼 먹는 한 그릇",
  difficulty: "medium",
  cookTimeMin: 35,
  servings: 2,
  estimatedCalories: 600,
  tags: ["나물", "한그릇", "건강"],
  recipe: {
    steps: [
      "1. 시금치·콩나물을 데쳐 무친다.",
      "2. 당근은 채 썰어 볶고 소고기는 양념해 볶는다.",
      "3. 계란을 반숙으로 부친다.",
      "4. 밥 위에 재료를 올리고 고추장·참기름을 넣어 비빈다.",
    ],
    tips: ["나물은 각각 간을 해야 맛이 산다."],
  },
  ingredients: [
    { name: "시금치", quantity: 100, unit: "g", category: "vegetable", pantryStaple: false },
    { name: "콩나물", quantity: 100, unit: "g", category: "vegetable", pantryStaple: false },
    { name: "당근", quantity: 1, unit: "개", category: "vegetable", pantryStaple: false },
    { name: "소고기 우둔살", quantity: 100, unit: "g", category: "meat", pantryStaple: false },
    { name: "계란", quantity: 2, unit: "개", category: "dairy", pantryStaple: false },
    { name: "고추장", quantity: 2, unit: "큰술", category: "seasoning", pantryStaple: true },
    { name: "참기름", quantity: 1, unit: "큰술", category: "seasoning", pantryStaple: true },
  ],
};

const mapo: HomeMenuOption = {
  id: "cn-mapo",
  name: "마파두부",
  cuisine: "CN",
  type: "home",
  description: "두반장으로 칼칼하게 볶은 두부 요리",
  difficulty: "medium",
  cookTimeMin: 30,
  servings: 2,
  estimatedCalories: 520,
  tags: ["매콤", "두부", "볶음"],
  recipe: {
    steps: [
      "1. 두부를 깍둑썰기하고 살짝 데친다.",
      "2. 팬에 다진돼지고기를 볶다가 두반장·다진마늘을 넣는다.",
      "3. 물과 간장을 넣고 두부를 넣어 조린다.",
      "4. 전분물로 농도를 맞추고 대파를 넣는다.",
    ],
    tips: ["전분물은 마지막에 조금씩 넣어 농도를 조절한다."],
  },
  ingredients: [
    { name: "두부", quantity: 300, unit: "g", category: "etc", pantryStaple: false },
    { name: "다진돼지고기", quantity: 150, unit: "g", category: "meat", pantryStaple: false },
    { name: "두반장", quantity: 1, unit: "큰술", category: "seasoning", pantryStaple: false },
    { name: "대파", quantity: 1, unit: "대", category: "vegetable", pantryStaple: false },
    { name: "다진마늘", quantity: 1, unit: "큰술", category: "seasoning", pantryStaple: true },
    { name: "간장", quantity: 1, unit: "큰술", category: "seasoning", pantryStaple: true },
    { name: "식용유", quantity: 1, unit: "큰술", category: "seasoning", pantryStaple: true },
  ],
};

const jjajang: HomeMenuOption = {
  id: "cn-jjajang",
  name: "집짜장",
  cuisine: "CN",
  type: "home",
  description: "춘장을 볶아 만든 든든한 짜장면",
  difficulty: "medium",
  cookTimeMin: 40,
  servings: 2,
  estimatedCalories: 720,
  tags: ["춘장", "면", "든든"],
  recipe: {
    steps: [
      "1. 춘장을 식용유에 볶아 기름장을 만든다.",
      "2. 돼지고기·양파·감자·애호박을 깍둑썰기해 볶는다.",
      "3. 볶은 춘장과 물을 넣고 끓인다.",
      "4. 전분물로 농도를 맞추고 삶은 면에 올린다.",
    ],
    tips: ["춘장은 충분히 볶아야 쓴맛이 사라진다."],
  },
  ingredients: [
    { name: "춘장", quantity: 3, unit: "큰술", category: "seasoning", pantryStaple: false },
    { name: "돼지고기 앞다리살", quantity: 150, unit: "g", category: "meat", pantryStaple: false },
    { name: "양파", quantity: 1, unit: "개", category: "vegetable", pantryStaple: false },
    { name: "감자", quantity: 1, unit: "개", category: "vegetable", pantryStaple: false },
    { name: "애호박", quantity: 1, unit: "개", category: "vegetable", pantryStaple: false },
    { name: "중화면", quantity: 2, unit: "개", category: "grain", pantryStaple: false },
    { name: "식용유", quantity: 2, unit: "큰술", category: "seasoning", pantryStaple: true },
  ],
};

const tangsuyuk: HomeMenuOption = {
  id: "cn-tangsuyuk",
  name: "탕수육",
  cuisine: "CN",
  type: "home",
  description: "바삭한 튀김과 새콤달콤 소스",
  difficulty: "hard",
  cookTimeMin: 50,
  servings: 2,
  estimatedCalories: 800,
  tags: ["튀김", "새콤달콤", "돼지고기"],
  recipe: {
    steps: [
      "1. 돼지등심을 길게 썰어 밑간한다.",
      "2. 전분·계란으로 튀김옷을 입혀 두 번 튀긴다.",
      "3. 물·식초·설탕·간장으로 소스를 끓인다.",
      "4. 당근·양파를 넣고 전분물로 농도를 맞춘다.",
      "5. 튀긴 고기에 소스를 곁들인다.",
    ],
    tips: ["두 번 튀기면 더 바삭하다."],
  },
  ingredients: [
    { name: "돼지등심", quantity: 300, unit: "g", category: "meat", pantryStaple: false },
    { name: "전분", quantity: 1, unit: "컵", category: "grain", pantryStaple: false },
    { name: "계란", quantity: 1, unit: "개", category: "dairy", pantryStaple: false },
    { name: "당근", quantity: 1, unit: "개", category: "vegetable", pantryStaple: false },
    { name: "양파", quantity: 1, unit: "개", category: "vegetable", pantryStaple: false },
    { name: "식초", quantity: 2, unit: "큰술", category: "seasoning", pantryStaple: false },
    { name: "설탕", quantity: 2, unit: "큰술", category: "seasoning", pantryStaple: true },
    { name: "식용유", quantity: 2, unit: "컵", category: "seasoning", pantryStaple: true },
  ],
};

const katsudon: HomeMenuOption = {
  id: "jp-katsudon",
  name: "가츠동",
  cuisine: "JP",
  type: "home",
  description: "바삭한 돈까스를 계란으로 덮은 덮밥",
  difficulty: "medium",
  cookTimeMin: 35,
  servings: 2,
  estimatedCalories: 780,
  tags: ["덮밥", "돈까스", "계란"],
  recipe: {
    steps: [
      "1. 돈까스를 바삭하게 튀긴다.",
      "2. 양파를 채 썰어 간장·설탕·맛술 소스에 끓인다.",
      "3. 썬 돈까스를 올리고 계란을 풀어 덮는다.",
      "4. 반숙으로 익혀 밥 위에 올린다.",
    ],
    tips: ["계란은 반숙일 때 불을 끈다."],
  },
  ingredients: [
    { name: "돈까스용 돼지고기", quantity: 200, unit: "g", category: "meat", pantryStaple: false },
    { name: "양파", quantity: 1, unit: "개", category: "vegetable", pantryStaple: false },
    { name: "계란", quantity: 2, unit: "개", category: "dairy", pantryStaple: false },
    { name: "맛술", quantity: 2, unit: "큰술", category: "seasoning", pantryStaple: false },
    { name: "간장", quantity: 2, unit: "큰술", category: "seasoning", pantryStaple: true },
    { name: "설탕", quantity: 1, unit: "큰술", category: "seasoning", pantryStaple: true },
  ],
};

const salmonDon: HomeMenuOption = {
  id: "jp-salmondon",
  name: "연어덮밥",
  cuisine: "JP",
  type: "home",
  description: "신선한 연어를 올린 간편 덮밥",
  difficulty: "easy",
  cookTimeMin: 20,
  servings: 2,
  estimatedCalories: 540,
  tags: ["연어", "덮밥", "간편"],
  recipe: {
    steps: [
      "1. 연어를 한입 크기로 썬다.",
      "2. 간장·와사비로 간장소스를 만든다.",
      "3. 밥 위에 연어·아보카도를 올린다.",
      "4. 김을 잘라 올리고 소스를 뿌린다.",
    ],
    tips: ["연어는 차갑게 보관했다가 바로 올린다."],
  },
  ingredients: [
    { name: "생연어", quantity: 200, unit: "g", category: "seafood", pantryStaple: false },
    { name: "아보카도", quantity: 1, unit: "개", category: "fruit", pantryStaple: false },
    { name: "김", quantity: 2, unit: "장", category: "etc", pantryStaple: false },
    { name: "간장", quantity: 2, unit: "큰술", category: "seasoning", pantryStaple: true },
    { name: "와사비", quantity: 1, unit: "약간", category: "seasoning", pantryStaple: false },
  ],
};

const gyudon: HomeMenuOption = {
  id: "jp-gyudon",
  name: "규동",
  cuisine: "JP",
  type: "home",
  description: "달큰하게 조린 소고기 덮밥",
  difficulty: "easy",
  cookTimeMin: 25,
  servings: 2,
  estimatedCalories: 650,
  tags: ["소고기", "덮밥", "간편"],
  recipe: {
    steps: [
      "1. 양파를 채 썬다.",
      "2. 냄비에 간장·설탕·맛술·물을 넣고 끓인다.",
      "3. 양파와 소고기를 넣어 조린다.",
      "4. 계란을 풀어 살짝 익히고 밥 위에 올린다.",
    ],
    tips: ["소고기는 얇게 썬 것을 쓴다."],
  },
  ingredients: [
    { name: "소고기 불고기감", quantity: 200, unit: "g", category: "meat", pantryStaple: false },
    { name: "양파", quantity: 1, unit: "개", category: "vegetable", pantryStaple: false },
    { name: "계란", quantity: 1, unit: "개", category: "dairy", pantryStaple: false },
    { name: "맛술", quantity: 2, unit: "큰술", category: "seasoning", pantryStaple: false },
    { name: "간장", quantity: 2, unit: "큰술", category: "seasoning", pantryStaple: true },
    { name: "설탕", quantity: 1, unit: "큰술", category: "seasoning", pantryStaple: true },
  ],
};

const creamPasta: HomeMenuOption = {
  id: "ws-creampasta",
  name: "크림파스타",
  cuisine: "WS",
  type: "home",
  description: "고소한 생크림과 베이컨의 조화",
  difficulty: "medium",
  cookTimeMin: 30,
  servings: 2,
  estimatedCalories: 720,
  tags: ["크림", "파스타", "베이컨"],
  recipe: {
    steps: [
      "1. 스파게티면을 소금물에 삶는다.",
      "2. 베이컨·마늘·양송이를 볶는다.",
      "3. 생크림을 붓고 파마산치즈로 농도를 맞춘다.",
      "4. 삶은 면을 넣어 버무린다.",
    ],
    tips: ["면수를 조금 넣으면 소스가 부드러워진다."],
  },
  ingredients: [
    { name: "스파게티면", quantity: 200, unit: "g", category: "grain", pantryStaple: false },
    { name: "생크림", quantity: 200, unit: "ml", category: "dairy", pantryStaple: false },
    { name: "베이컨", quantity: 100, unit: "g", category: "meat", pantryStaple: false },
    { name: "양송이버섯", quantity: 4, unit: "개", category: "vegetable", pantryStaple: false },
    { name: "마늘", quantity: 3, unit: "쪽", category: "vegetable", pantryStaple: false },
    { name: "파마산치즈", quantity: 30, unit: "g", category: "dairy", pantryStaple: false },
    { name: "소금", quantity: 1, unit: "약간", category: "seasoning", pantryStaple: true },
  ],
};

const tomatoPasta: HomeMenuOption = {
  id: "ws-tomatopasta",
  name: "토마토파스타",
  cuisine: "WS",
  type: "home",
  description: "상큼한 토마토소스 파스타",
  difficulty: "easy",
  cookTimeMin: 25,
  servings: 2,
  estimatedCalories: 560,
  tags: ["토마토", "파스타", "상큼"],
  recipe: {
    steps: [
      "1. 스파게티면을 삶는다.",
      "2. 마늘·양파를 올리브유에 볶는다.",
      "3. 토마토소스를 넣고 끓인다.",
      "4. 면을 넣어 버무리고 소금으로 간한다.",
    ],
    tips: ["설탕 약간으로 토마토의 신맛을 잡는다."],
  },
  ingredients: [
    { name: "스파게티면", quantity: 200, unit: "g", category: "grain", pantryStaple: false },
    { name: "토마토소스", quantity: 300, unit: "g", category: "seasoning", pantryStaple: false },
    { name: "양파", quantity: 1, unit: "개", category: "vegetable", pantryStaple: false },
    { name: "마늘", quantity: 3, unit: "쪽", category: "vegetable", pantryStaple: false },
    { name: "올리브유", quantity: 2, unit: "큰술", category: "seasoning", pantryStaple: true },
    { name: "소금", quantity: 1, unit: "약간", category: "seasoning", pantryStaple: true },
  ],
};

const steak: HomeMenuOption = {
  id: "ws-steak",
  name: "스테이크",
  cuisine: "WS",
  type: "home",
  description: "겉바속촉 소고기 스테이크",
  difficulty: "medium",
  cookTimeMin: 25,
  servings: 2,
  estimatedCalories: 700,
  tags: ["소고기", "구이", "특별식"],
  recipe: {
    steps: [
      "1. 소고기를 실온에 두고 소금·후추로 밑간한다.",
      "2. 달군 팬에 굽고 버터·마늘을 넣어 향을 입힌다.",
      "3. 레스팅 후 썬다.",
      "4. 구운 감자·아스파라거스를 곁들인다.",
    ],
    tips: ["굽고 나서 5분 레스팅하면 육즙이 유지된다."],
  },
  ingredients: [
    { name: "소고기 등심", quantity: 400, unit: "g", category: "meat", pantryStaple: false },
    { name: "감자", quantity: 2, unit: "개", category: "vegetable", pantryStaple: false },
    { name: "아스파라거스", quantity: 4, unit: "대", category: "vegetable", pantryStaple: false },
    { name: "버터", quantity: 30, unit: "g", category: "dairy", pantryStaple: false },
    { name: "마늘", quantity: 3, unit: "쪽", category: "vegetable", pantryStaple: false },
    { name: "소금", quantity: 1, unit: "약간", category: "seasoning", pantryStaple: true },
    { name: "후추", quantity: 1, unit: "약간", category: "seasoning", pantryStaple: true },
  ],
};

// ----------------------------------------------------------------------------
// 외식 메뉴 풀
// ----------------------------------------------------------------------------
const dineoutSushi: DineoutMenuOption = {
  id: "do-sushi",
  name: "동네 초밥집 모둠초밥",
  cuisine: "DINEOUT",
  type: "dineout",
  description: "가볍게 사먹기 좋은 점심",
  tags: ["일식계열", "간편"],
  searchKeyword: "초밥 맛집",
};

const dineoutJjamppong: DineoutMenuOption = {
  id: "do-jjamppong",
  name: "중국집 짬뽕",
  cuisine: "DINEOUT",
  type: "dineout",
  description: "얼큰한 국물이 생각날 때",
  tags: ["중식계열", "국물"],
  searchKeyword: "짬뽕 맛집",
};

const dineoutTteokbokki: DineoutMenuOption = {
  id: "do-tteokbokki",
  name: "분식집 떡볶이 세트",
  cuisine: "DINEOUT",
  type: "dineout",
  description: "간단하게 떼우는 한 끼",
  tags: ["분식", "매콤"],
  searchKeyword: "떡볶이 맛집",
};

const dineoutBurger: DineoutMenuOption = {
  id: "do-burger",
  name: "수제버거",
  cuisine: "DINEOUT",
  type: "dineout",
  description: "든든한 양식 한 끼",
  tags: ["양식계열", "패스트푸드"],
  searchKeyword: "수제버거 맛집",
};

const dineoutGukbap: DineoutMenuOption = {
  id: "do-gukbap",
  name: "돼지국밥",
  cuisine: "DINEOUT",
  type: "dineout",
  description: "뜨끈한 국물 한 그릇",
  tags: ["한식계열", "국물"],
  searchKeyword: "돼지국밥 맛집",
};

// 모든 메뉴(상세 조회용 평탄 목록)
const ALL_MENUS: MenuOption[] = [
  jeyuk, kimchiJjigae, doenjangJjigae, bibimbap,
  mapo, jjajang, tangsuyuk,
  katsudon, salmonDon, gyudon,
  creamPasta, tomatoPasta, steak,
  dineoutSushi, dineoutJjamppong, dineoutTteokbokki, dineoutBurger, dineoutGukbap,
];

/** id로 메뉴 조회 (상세 화면용). Phase 1에선 useMenu(menuId)로 대체. */
export function getMenuById(id: string): MenuOption | undefined {
  return ALL_MENUS.find((m) => m.id === id);
}

// ----------------------------------------------------------------------------
// 선지 세트 — 각 세트는 정확히 5개(집밥 4 + 외식 1), cuisine 다양 (RULES R1)
// ----------------------------------------------------------------------------
const setA: MenuOption[] = [jeyuk, mapo, katsudon, creamPasta, dineoutSushi];
const setB: MenuOption[] = [kimchiJjigae, jjajang, salmonDon, tomatoPasta, dineoutJjamppong];
const setC: MenuOption[] = [bibimbap, tangsuyuk, gyudon, steak, dineoutTteokbokki];
const setD: MenuOption[] = [doenjangJjigae, mapo, salmonDon, creamPasta, dineoutBurger];
const setE: MenuOption[] = [jeyuk, jjajang, katsudon, tomatoPasta, dineoutGukbap];
const setF: MenuOption[] = [kimchiJjigae, tangsuyuk, gyudon, steak, dineoutSushi];

// 각 슬롯은 [기본 세트, 갱신 세트] 형태. 갱신 시 다른 세트로 스왑된다.
const SLOT_SETS: MenuOption[][][] = [
  [setA, setB], // day0 lunch
  [setC, setD], // day0 dinner
  [setB, setE], // day1 lunch
  [setF, setA], // day1 dinner
  [setC, setF], // day2 lunch
  [setA, setE], // day2 dinner
  [setD, setB], // day3 lunch
  [setE, setC], // day3 dinner
  [setE, setA], // day4 lunch
  [setB, setF], // day4 dinner
  [setF, setC], // day5 lunch
  [setD, setA], // day5 dinner
  [setA, setD], // day6 lunch
  [setC, setB], // day6 dinner
];

/** 샘플 주간 계획. Phase 1에선 useWeekPlan()로 대체. */
export const mockWeekPlan: WeekPlan = {
  weekStart: "2026-06-29",
  slots: Array.from({ length: 14 }, (_, i) => ({
    dayIndex: Math.floor(i / 2),
    meal: i % 2 === 0 ? ("lunch" as const) : ("dinner" as const),
    optionSets: SLOT_SETS[i],
  })),
};

// ----------------------------------------------------------------------------
// 장바구니 — 확정(선택)된 메뉴들의 재료 합산 (RULES R4)
// ----------------------------------------------------------------------------

/** 동의어 통합 (RULES R4). 실제 구현에선 더 큰 표를 코드로 관리. */
const ingredientAliases: Record<string, string> = {
  파: "대파",
  다진마늘: "마늘",
};

function normalizeName(name: string): string {
  return ingredientAliases[name] ?? name;
}

/**
 * 선택 확정된 메뉴들의 재료를 합산한다 (RULES R4).
 * - (정규화명 + 단위) 동일 항목은 수량 합산.
 * - 단위가 다르면 별도 항목 (임의 환산 금지).
 * - `약간`은 합산하지 않고 그대로 둔다.
 */
export function aggregateIngredients(menus: MenuOption[]): CartItem[] {
  const map = new Map<string, CartItem>();
  for (const menu of menus) {
    if (!isHomeMenu(menu)) continue;
    for (const ing of menu.ingredients) {
      const name = normalizeName(ing.name);
      const key = `${name}__${ing.unit}`;
      const existing = map.get(key);
      if (existing) {
        if (ing.unit !== "약간") existing.quantity += ing.quantity;
      } else {
        map.set(key, {
          name,
          quantity: ing.quantity,
          unit: ing.unit,
          category: ing.category,
          pantryStaple: ing.pantryStaple,
        });
      }
    }
  }
  return [...map.values()];
}

/** 이번 주 "확정"된 메뉴 샘플 (장바구니 시연용). Phase 1에선 meal_slots에서 가져온다. */
export const mockSelectedMenus: MenuOption[] = [
  jeyuk, kimchiJjigae, mapo, creamPasta, tomatoPasta, gyudon, dineoutSushi,
];

/** 장바구니 합산 결과 (시연용). */
export const mockCartItems: CartItem[] = aggregateIngredients(mockSelectedMenus);
