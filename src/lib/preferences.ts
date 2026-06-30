// =============================================================================
// 취향 학습 + 인분 수 + 식사 스타일 — 계정(Supabase) 동기화 스토어.
// RULES R3(학습) / R5(인분) / R1-2(식사 스타일).
//
// 단일 출처는 Supabase `preference_profiles`. 로그인하면 거기서 로드해 즉시
// 모든 기기에 동일하게 반영된다. localStorage 는 첫 렌더/오프라인용 캐시일 뿐,
// 로그인 시 DB 값으로 덮어쓴다. 모든 변경은 DB 에 write-through 한다.
// =============================================================================
import { useSyncExternalStore } from "react";
import type { Cuisine, SeedMenu } from "@shared/types";
import { supabase } from "./supabaseClient";

/** 취향 프로파일 상태 — RULES R3. */
export interface PreferencesState {
  cuisineWeights: Record<Cuisine, number>;
  tagWeights: Record<string, number>;
  /** dislike 한 메뉴 id — 하드 필터(차단). */
  dislikedMenuIds: string[];
  dislikedIngredients: string[];
  allergies: string[];
}

/** 식사 스타일: 집밥 위주 / 균형 / 외식 위주 (RULES R1-2). */
export type DiningStyle = "home" | "balanced" | "dineout";
const DINING_STYLES: readonly DiningStyle[] = ["home", "balanced", "dineout"];

const PREFS_KEY = "prefs:v1"; // 오프라인 캐시
const SERVINGS_KEY = "mp.servings";
const DINING_KEY = "mp.diningStyle";

// RULES R3 신호별 가중치 변화.
const LIKE_DELTA = 5;
const DISLIKE_DELTA = -5;
const SELECT_DELTA = 3; // 확정(select)

function emptyPrefs(): PreferencesState {
  return {
    cuisineWeights: {} as Record<Cuisine, number>,
    tagWeights: {},
    dislikedMenuIds: [],
    dislikedIngredients: [],
    allergies: [],
  };
}

// ---- caches + listeners ------------------------------------------------------

let prefsCache: PreferencesState | null = null;
let servingsCache: number | null | undefined;
let diningCache: DiningStyle | undefined;

const prefsListeners = new Set<() => void>();
const servingsListeners = new Set<() => void>();
const diningListeners = new Set<() => void>();

function notifyAll(): void {
  prefsListeners.forEach((l) => l());
  servingsListeners.forEach((l) => l());
  diningListeners.forEach((l) => l());
}

// ---- localStorage (offline cache) --------------------------------------------

function lsGet(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}
function lsSet(key: string, value: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    // 무시.
  }
}

function readPrefs(): PreferencesState {
  if (prefsCache) return prefsCache;
  const raw = lsGet(PREFS_KEY);
  try {
    prefsCache = raw
      ? { ...emptyPrefs(), ...(JSON.parse(raw) as Partial<PreferencesState>) }
      : emptyPrefs();
  } catch {
    prefsCache = emptyPrefs();
  }
  return prefsCache;
}
function readServings(): number | null {
  if (servingsCache !== undefined) return servingsCache;
  const raw = lsGet(SERVINGS_KEY);
  servingsCache = raw ? Number(raw) : null;
  return servingsCache;
}
function readDining(): DiningStyle {
  if (diningCache !== undefined) return diningCache;
  const raw = lsGet(DINING_KEY);
  diningCache = DINING_STYLES.includes(raw as DiningStyle)
    ? (raw as DiningStyle)
    : "balanced";
  return diningCache;
}

/** 메모리+localStorage 캐시를 갱신하고, DB 로 write-through 한다. */
function commit(opts: {
  prefs?: PreferencesState;
  servings?: number | null;
  dining?: DiningStyle;
}): void {
  if (opts.prefs !== undefined) {
    prefsCache = opts.prefs;
    lsSet(PREFS_KEY, JSON.stringify(opts.prefs));
  }
  if (opts.servings !== undefined) {
    servingsCache = opts.servings;
    lsSet(SERVINGS_KEY, opts.servings === null ? null : String(opts.servings));
  }
  if (opts.dining !== undefined) {
    diningCache = opts.dining;
    lsSet(DINING_KEY, opts.dining);
  }
  notifyAll();
  void pushProfile();
}

// ---- Supabase: 단일 출처 ------------------------------------------------------

/** 현재 캐시 전체를 preference_profiles 에 upsert (best-effort). */
async function pushProfile(): Promise<void> {
  try {
    const { data } = await supabase.auth.getUser();
    const user = data.user;
    if (!user) return;
    const p = readPrefs();
    await supabase.from("preference_profiles").upsert(
      {
        user_id: user.id,
        cuisine_weights: p.cuisineWeights,
        tag_weights: p.tagWeights,
        disliked_menu_ids: p.dislikedMenuIds,
        disliked_ingredients: p.dislikedIngredients,
        allergies: p.allergies,
        last_servings: readServings(),
        dining_style: readDining(),
      },
      { onConflict: "user_id" },
    );
  } catch {
    // 네트워크 실패는 무시 — 캐시는 유지되고 다음 변경에서 다시 시도된다.
  }
}

/** 로그인 시 DB 값으로 캐시를 덮어쓴다(= 즉시 동기화). */
async function hydrateFromSupabase(): Promise<void> {
  try {
    const { data: u } = await supabase.auth.getUser();
    const user = u.user;
    if (!user) return;
    const { data, error } = await supabase
      .from("preference_profiles")
      .select(
        "cuisine_weights, tag_weights, disliked_menu_ids, disliked_ingredients, allergies, last_servings, dining_style",
      )
      .eq("user_id", user.id)
      .maybeSingle();
    if (error || !data) return;
    prefsCache = {
      cuisineWeights: (data.cuisine_weights ?? {}) as Record<Cuisine, number>,
      tagWeights: (data.tag_weights ?? {}) as Record<string, number>,
      dislikedMenuIds: data.disliked_menu_ids ?? [],
      dislikedIngredients: data.disliked_ingredients ?? [],
      allergies: data.allergies ?? [],
    };
    servingsCache = data.last_servings ?? null;
    diningCache = DINING_STYLES.includes(data.dining_style as DiningStyle)
      ? (data.dining_style as DiningStyle)
      : "balanced";
    lsSet(PREFS_KEY, JSON.stringify(prefsCache));
    lsSet(SERVINGS_KEY, servingsCache === null ? null : String(servingsCache));
    lsSet(DINING_KEY, diningCache);
    notifyAll();
  } catch {
    // 무시 — 오프라인 캐시로 계속 동작.
  }
}

// 세션이 잡히면(초기/로그인) DB 에서 동기화.
if (typeof window !== "undefined") {
  void hydrateFromSupabase();
  supabase.auth.onAuthStateChange((_event, session) => {
    if (session?.user) void hydrateFromSupabase();
  });
}

// ---- hooks / getters ---------------------------------------------------------

export function usePreferences(): PreferencesState {
  return useSyncExternalStore(
    (cb) => (prefsListeners.add(cb), () => prefsListeners.delete(cb)),
    readPrefs,
    readPrefs,
  );
}
export function getPreferences(): PreferencesState {
  return readPrefs();
}
export function useServings(): number | null {
  return useSyncExternalStore(
    (cb) => (servingsListeners.add(cb), () => servingsListeners.delete(cb)),
    readServings,
    readServings,
  );
}
export function getServings(): number | null {
  return readServings();
}
export function useDiningStyle(): DiningStyle {
  return useSyncExternalStore(
    (cb) => (diningListeners.add(cb), () => diningListeners.delete(cb)),
    readDining,
    readDining,
  );
}
export function getDiningStyle(): DiningStyle {
  return readDining();
}

// ---- mutators (RULES R3 / R5 / R1-2) -----------------------------------------

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
  const s = readPrefs();
  commit({
    prefs: {
      ...s,
      ...applyWeights(s, menu.cuisine, menu.tags, LIKE_DELTA),
      dislikedMenuIds: s.dislikedMenuIds.filter((id) => id !== menu.id),
    },
  });
}

/** 싫어요: cuisine/tags -5, 해당 메뉴 차단 — RULES R3. */
export function dislikeMenu(menu: SeedMenu): void {
  const s = readPrefs();
  const dislikedMenuIds = s.dislikedMenuIds.includes(menu.id)
    ? s.dislikedMenuIds
    : [...s.dislikedMenuIds, menu.id];
  commit({
    prefs: {
      ...s,
      ...applyWeights(s, menu.cuisine, menu.tags, DISLIKE_DELTA),
      dislikedMenuIds,
    },
  });
}

/** 확정(select): cuisine/tags +3 — RULES R3. 확정 시 호출. */
export function recordSelection(menu: SeedMenu): void {
  const s = readPrefs();
  commit({
    prefs: { ...s, ...applyWeights(s, menu.cuisine, menu.tags, SELECT_DELTA) },
  });
}

/** 피드백 해제: 메뉴 차단을 푼다(가중치는 유지). */
export function clearFeedback(menuId: string): void {
  const s = readPrefs();
  if (!s.dislikedMenuIds.includes(menuId)) return;
  commit({
    prefs: { ...s, dislikedMenuIds: s.dislikedMenuIds.filter((id) => id !== menuId) },
  });
}

export function setAllergies(list: string[]): void {
  commit({ prefs: { ...readPrefs(), allergies: list } });
}
export function setDislikedIngredients(list: string[]): void {
  commit({ prefs: { ...readPrefs(), dislikedIngredients: list } });
}
export function resetLearning(): void {
  commit({ prefs: emptyPrefs() });
}
export function setServings(value: number | null): void {
  commit({ servings: value });
}
export function setDiningStyle(value: DiningStyle): void {
  commit({ dining: value });
}
