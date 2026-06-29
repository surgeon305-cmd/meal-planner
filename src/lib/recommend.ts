import { seedPool } from "@shared/seed";
import type { SeedMenu, Cuisine } from "@shared/types";

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

  const homeAvail = seededShuffle(
    HOME_POOL.filter(
      (m) => !excludedIds.has(m.id) && !excludedCuisines.has(m.cuisine),
    ),
    variant + 1,
  );
  const dineoutAvail = seededShuffle(
    DINEOUT_POOL.filter((m) => !excludedIds.has(m.id)),
    variant + 7,
  );

  const home = pickHome(homeAvail, 4);
  const dineout = dineoutAvail.slice(0, 1);

  let options = [...home, ...dineout];

  // 5개 미만이면(극단적 제외) 제약을 풀어 채운다 — 항상 5개 보장(R1-1).
  if (options.length < 5) {
    const used = new Set(options.map((m) => m.id));
    const fillers = seededShuffle(
      seedPool.filter((m) => !used.has(m.id) && !excludedIds.has(m.id)),
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
