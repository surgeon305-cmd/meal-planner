// =============================================================================
// 취향 학습 + 인분 수 — localStorage 단일 출처(source of truth) 외부 스토어.
// RULES R3(학습) / R5(인분 수).
// - 취향: `prefs:v1` 에 가중치/차단/알레르기 누적. like +5, dislike -5 (cuisine·tag).
// - 인분: SettingsScreen 이 쓰던 기존 키 `mp.servings` 를 그대로 재사용(R5).
// - 세션이 있으면 Supabase `preference_profiles` 에 best-effort 미러(블로킹 금지).
// =============================================================================
import { useSyncExternalStore } from "react";
import type { Cuisine, SeedMenu } from "@shared/types";
import { supabase } from "./supabaseClient";

/** 취향 프로파일 상태(localStorage `prefs:v1`) — RULES R3. */
export interface PreferencesState {
  /** cuisine 단위 누적 가중치. */
  cuisineWeights: Record<Cuisine, number>;
  /** tag 단위 누적 가중치. */
  tagWeights: Record<string, number>;
  /** dislike 한 메뉴 id — 하드 필터(차단). */
  dislikedMenuIds: string[];
  /** 비선호 재료 — 하드 필터. */
  dislikedIngredients: string[];
  /** 알레르기 — 항상 하드 필터. */
  allergies: string[];
}

const PREFS_KEY = "prefs:v1";
/** SettingsScreen 이 이미 쓰던 인분 수 키. 재사용(R5). */
const SERVINGS_KEY = "mp.servings";

/** RULES R3 신호별 가중치 변화. */
const LIKE_DELTA = 5;
const DISLIKE_DELTA = -5;

function emptyPrefs(): PreferencesState {
  return {
    cuisineWeights: {} as Record<Cuisine, number>,
    tagWeights: {},
    dislikedMenuIds: [],
    dislikedIngredients: [],
    allergies: [],
  };
}

// ---- preferences external store ----------------------------------------------

let prefsCache: PreferencesState | null = null;
const prefsListeners = new Set<() => void>();

function readPrefs(): PreferencesState {
  if (prefsCache) return prefsCache;
  if (typeof window === "undefined") {
    prefsCache = emptyPrefs();
    return prefsCache;
  }
  try {
    const raw = window.localStorage.getItem(PREFS_KEY);
    prefsCache = raw
      ? { ...emptyPrefs(), ...(JSON.parse(raw) as Partial<PreferencesState>) }
      : emptyPrefs();
  } catch {
    prefsCache = emptyPrefs();
  }
  return prefsCache;
}

function writePrefs(next: PreferencesState): void {
  prefsCache = next;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(PREFS_KEY, JSON.stringify(next));
    } catch {
      // 쿼터 등 저장 실패는 조용히 무시 — 메모리 캐시가 유지된다.
    }
  }
  prefsListeners.forEach((l) => l());
  void mirrorToSupabase(next);
}

function subscribePrefs(cb: () => void): () => void {
  prefsListeners.add(cb);
  return () => {
    prefsListeners.delete(cb);
  };
}

/** 훅: 취향 상태를 구독한다(컴포넌트용). */
export function usePreferences(): PreferencesState {
  return useSyncExternalStore(subscribePrefs, readPrefs, readPrefs);
}

/** 비훅 getter — recommend.ts 등 모듈에서 사용. */
export function getPreferences(): PreferencesState {
  return readPrefs();
}

// ---- mutators (RULES R3) -----------------------------------------------------

function applyWeights(
  state: PreferencesState,
  cuisine: Cuisine,
  tags: readonly string[],
  delta: number,
): Pick<PreferencesState, "cuisineWeights" | "tagWeights"> {
  const cuisineWeights: Record<Cuisine, number> = {
    ...state.cuisineWeights,
    [cuisine]: (state.cuisineWeights[cuisine] ?? 0) + delta,
  };
  const tagWeights: Record<string, number> = { ...state.tagWeights };
  for (const t of tags) tagWeights[t] = (tagWeights[t] ?? 0) + delta;
  return { cuisineWeights, tagWeights };
}

/** 좋아요: cuisine/tags +5, 차단 해제 — RULES R3. */
export function likeMenu(menu: SeedMenu): void {
  const state = readPrefs();
  writePrefs({
    ...state,
    ...applyWeights(state, menu.cuisine, menu.tags, LIKE_DELTA),
    dislikedMenuIds: state.dislikedMenuIds.filter((id) => id !== menu.id),
  });
}

/** 싫어요: cuisine/tags -5, 해당 메뉴 차단 — RULES R3. */
export function dislikeMenu(menu: SeedMenu): void {
  const state = readPrefs();
  const dislikedMenuIds = state.dislikedMenuIds.includes(menu.id)
    ? state.dislikedMenuIds
    : [...state.dislikedMenuIds, menu.id];
  writePrefs({
    ...state,
    ...applyWeights(state, menu.cuisine, menu.tags, DISLIKE_DELTA),
    dislikedMenuIds,
  });
}

/** 피드백 해제: 메뉴 차단을 푼다(가중치는 신호로 유지). */
export function clearFeedback(menuId: string): void {
  const state = readPrefs();
  if (!state.dislikedMenuIds.includes(menuId)) return;
  writePrefs({
    ...state,
    dislikedMenuIds: state.dislikedMenuIds.filter((id) => id !== menuId),
  });
}

/** 알레르기 목록 설정(하드 필터) — RULES R3. */
export function setAllergies(list: string[]): void {
  writePrefs({ ...readPrefs(), allergies: list });
}

/** 비선호 재료 목록 설정(하드 필터) — RULES R3. */
export function setDislikedIngredients(list: string[]): void {
  writePrefs({ ...readPrefs(), dislikedIngredients: list });
}

/** 학습 초기화 — RULES R3(설정에서 초기화 가능). */
export function resetLearning(): void {
  writePrefs(emptyPrefs());
}

// ---- Supabase best-effort mirror ---------------------------------------------

async function mirrorToSupabase(state: PreferencesState): Promise<void> {
  try {
    const { data } = await supabase.auth.getUser();
    const user = data.user;
    if (!user) return;
    await supabase.from("preference_profiles").upsert(
      {
        user_id: user.id,
        cuisine_weights: state.cuisineWeights,
        tag_weights: state.tagWeights,
        disliked_menu_ids: state.dislikedMenuIds,
        disliked_ingredients: state.dislikedIngredients,
        allergies: state.allergies,
      },
      { onConflict: "user_id" },
    );
  } catch {
    // 네트워크 실패는 무시 — localStorage 가 단일 출처다(R3).
  }
}

// ---- servings external store (RULES R5) --------------------------------------

let servingsCache: number | null | undefined;
const servingsListeners = new Set<() => void>();

function readServings(): number | null {
  if (servingsCache !== undefined) return servingsCache;
  if (typeof window === "undefined") {
    servingsCache = null;
    return null;
  }
  const raw = window.localStorage.getItem(SERVINGS_KEY);
  servingsCache = raw ? Number(raw) : null;
  return servingsCache;
}

/** 비훅 getter — 마지막으로 선택한 인분 수(없으면 null). */
export function getServings(): number | null {
  return readServings();
}

/** 인분 수 설정(다음 기본값으로 기억) — RULES R5. */
export function setServings(value: number | null): void {
  servingsCache = value;
  if (typeof window !== "undefined") {
    try {
      if (value === null) window.localStorage.removeItem(SERVINGS_KEY);
      else window.localStorage.setItem(SERVINGS_KEY, String(value));
    } catch {
      // 무시.
    }
  }
  servingsListeners.forEach((l) => l());
}

function subscribeServings(cb: () => void): () => void {
  servingsListeners.add(cb);
  return () => {
    servingsListeners.delete(cb);
  };
}

/** 훅: 선택된 인분 수를 구독한다(없으면 null). */
export function useServings(): number | null {
  return useSyncExternalStore(subscribeServings, readServings, readServings);
}

// ---- dining style external store (집밥/균형/외식 위주) ------------------------
// 선지 구성 비율을 조정한다 — RULES R1-2(기본 집밥4+외식1)의 사용자 오버라이드.

/** 식사 스타일: 집밥 위주 / 균형 / 외식 위주. */
export type DiningStyle = "home" | "balanced" | "dineout";

const DINING_KEY = "mp.diningStyle";
const DINING_STYLES: readonly DiningStyle[] = ["home", "balanced", "dineout"];

let diningCache: DiningStyle | undefined;
const diningListeners = new Set<() => void>();

function readDining(): DiningStyle {
  if (diningCache !== undefined) return diningCache;
  if (typeof window === "undefined") {
    diningCache = "balanced";
    return diningCache;
  }
  const raw = window.localStorage.getItem(DINING_KEY);
  diningCache = DINING_STYLES.includes(raw as DiningStyle)
    ? (raw as DiningStyle)
    : "balanced";
  return diningCache;
}

/** 비훅 getter — recommend.ts 에서 선지 구성 비율 결정에 사용. */
export function getDiningStyle(): DiningStyle {
  return readDining();
}

export function setDiningStyle(value: DiningStyle): void {
  diningCache = value;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(DINING_KEY, value);
    } catch {
      // 무시.
    }
  }
  diningListeners.forEach((l) => l());
}

function subscribeDining(cb: () => void): () => void {
  diningListeners.add(cb);
  return () => {
    diningListeners.delete(cb);
  };
}

/** 훅: 식사 스타일을 구독한다(기본 balanced). */
export function useDiningStyle(): DiningStyle {
  return useSyncExternalStore(subscribeDining, readDining, readDining);
}
