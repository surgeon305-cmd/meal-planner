import { seedPool } from "@shared/seed";
import type { SeedMenu, Cuisine } from "@shared/types";
import { getPreferences } from "./preferences";
import type { PreferencesState } from "./preferences";

/**
 * 시드 풀 기반 선지 추천 — RULES R1 / R9.
 * 한 슬롯 = 집밥 4 + 외식 1, 같은 요리종류 ≤2, 쿨다운/직전선지 제외.
 * AI(R6) 보충은 시드로 못 채울 때만(여기선 폴백으로 제약 완화).
 */

const HOME_POOL: SeedMenu[] = seedPool.filter((m) => m.type === "home");
const DINEOUT_POOL: SeedMenu[] = seedPool.filter((m) => m.type === "dineout");

export interface SlotConstraints {
  /** 쿨다운 등으로 제외할 요리종류 (집밥에만 적용) — RULES R1-4. */
  excludedCuisines?: Cuisine[];
  /** 직전에 보여준/이미 쓴 메뉴 id — RULES R1-5. */
  excludedIds?: string[];
  /** 갱신 시마다 다른 결과를 주기 위한 시드값. */
  variant?: number;
}

/** 결정적 셔플(시드값 기반) — 갱신마다 다른 순서, 새로고침엔 동일. */
function seededShuffle<T>(arr: T[], seed: number): T[] {
  const a = [...arr];
  let s = (seed * 2654435761) >>> 0 || 1;
  const rand = () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    s >>>= 0;
    return s / 0xffffffff;
  };
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * 취향 하드 필터 (RULES R3) — 차단 메뉴/알레르기/비선호 재료 완전 제외.
 * - dislikedMenuIds 에 든 메뉴는 항상 제외.
 * - 집밥은 재료명에 알레르기/비선호 재료가 포함(대소문자 무시 부분일치)되면 제외.
 */
function passesPrefFilter(menu: SeedMenu, prefs: PreferencesState): boolean {
  if (prefs.dislikedMenuIds.includes(menu.id)) return false;
  if (menu.type === "home") {
    const blocked = [...prefs.allergies, ...prefs.dislikedIngredients]
      .map((s) => s.trim().toLowerCase())
      .filter((s) => s.length > 0);
    if (blocked.length > 0) {
      for (const ing of menu.ingredients) {
        const name = ing.name.toLowerCase();
        if (blocked.some((b) => name.includes(b))) return false;
      }
    }
  }
  return true;
}

/** 취향 가중치 점수 (cuisine + tags 합) — RULES R3 (부드러운 편향). */
function prefScore(menu: SeedMenu, prefs: PreferencesState): number {
  let score = prefs.cuisineWeights[menu.cuisine] ?? 0;
  for (const t of menu.tags) score += prefs.tagWeights[t] ?? 0;
  return score;
}

/** 같은 요리종류 ≤2 제약을 지키며 최대 n개 집밥 선택 (R1-3). */
function pickHome(pool: SeedMenu[], n: number, perCuisineMax = 2): SeedMenu[] {
  const picked: SeedMenu[] = [];
  const count: Record<string, number> = {};
  for (const m of pool) {
    if (picked.length >= n) break;
    if ((count[m.cuisine] ?? 0) >= perCuisineMax) continue;
    picked.push(m);
    count[m.cuisine] = (count[m.cuisine] ?? 0) + 1;
  }
  // 제약 때문에 부족하면(쿨다운으로 종류가 적을 때) 남은 걸로 채움.
  if (picked.length < n) {
    for (const m of pool) {
      if (picked.length >= n) break;
      if (!picked.includes(m)) picked.push(m);
    }
  }
  return picked;
}

/**
 * 한 슬롯의 5선지 생성. 항상 5개를 보장(집밥 4 + 외식 1 목표,
 * 부족 시 가능한 만큼 + 폴백). 결과는 화면 표시용 SeedMenu[].
 */
export function buildSlotOptions(c: SlotConstraints = {}): SeedMenu[] {
  const excludedCuisines = new Set(c.excludedCuisines ?? []);
  const excludedIds = new Set(c.excludedIds ?? []);
  const variant = c.variant ?? 0;
  const prefs = getPreferences();

  const homeAvail = seededShuffle(
    HOME_POOL.filter(
      (m) =>
        !excludedIds.has(m.id) &&
        !excludedCuisines.has(m.cuisine) &&
        passesPrefFilter(m, prefs),
    ),
    variant + 1,
  );
  const dineoutAvail = seededShuffle(
    DINEOUT_POOL.filter(
      (m) => !excludedIds.has(m.id) && passesPrefFilter(m, prefs),
    ),
    variant + 7,
  );

  // 취향 가중치로 부드럽게 정렬하되, 탐색(wildcard) 1개는 남긴다 (RULES R1-6/R3).
  // sort 는 안정 정렬이라 동점은 셔플 순서를 유지 → 다양성 보존.
  const biased = [...homeAvail].sort(
    (a, b) => prefScore(b, prefs) - prefScore(a, prefs),
  );
  const wildcard = homeAvail[0];
  let homeOrdered: SeedMenu[];
  if (wildcard) {
    const head = biased.filter((m) => m.id !== wildcard.id).slice(0, 3);
    const headIds = new Set(head.map((m) => m.id));
    const tail = biased.filter(
      (m) => m.id !== wildcard.id && !headIds.has(m.id),
    );
    homeOrdered = [...head, wildcard, ...tail];
  } else {
    homeOrdered = biased;
  }

  const home = pickHome(homeOrdered, 4);
  const dineout = dineoutAvail.slice(0, 1);

  let options = [...home, ...dineout];

  // 5개 미만이면(극단적 제외) 제약을 풀어 채운다 — 항상 5개 보장(R1-1).
  if (options.length < 5) {
    const used = new Set(options.map((m) => m.id));
    const fillers = seededShuffle(
      seedPool.filter(
        (m) =>
          !used.has(m.id) &&
          !excludedIds.has(m.id) &&
          passesPrefFilter(m, prefs),
      ),
      variant + 13,
    );
    for (const m of fillers) {
      if (options.length >= 5) break;
      options.push(m);
      used.add(m.id);
    }
  }

  return options.slice(0, 5);
}

export { HOME_POOL, DINEOUT_POOL };
