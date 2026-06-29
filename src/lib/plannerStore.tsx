// =============================================================================
// PlannerStore — 날짜 기반 확정 엔트리 + 슬롯 갱신 variant의 영구 저장소.
// RULES R8 (날짜 기반 모델 · 확정=엔트리 저장 · 거른 날 자동 제외).
//
// 저장은 작은 어댑터 인터페이스(PlannerPersistence) 뒤에 둔다. 지금은 localStorage
// 구현을 쓰고, Phase 1에서 Supabase로 갈아끼운다 (인터페이스는 그대로).
// =============================================================================
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { ReactNode } from "react";
import type { Cuisine, MealType, SeedMenu } from "@shared/types";

/** 확정된 한 끼 (날짜+끼니에 저장되는 엔트리) — RULES R8-3. */
export interface Entry {
  menuId: string;
  cuisine: Cuisine;
  /** 확정 시점의 메뉴 스냅샷. */
  menu: SeedMenu;
}

/** 한 날짜의 두 슬롯 (점심/저녁). 선택 안 한 끼니는 없음(=거른 날) — RULES R8-4. */
export interface DayEntries {
  lunch?: Entry;
  dinner?: Entry;
}

/** 전체 상태: 날짜별 확정 엔트리 + 슬롯별 갱신 variant. */
export interface PlannerState {
  /** key: 'YYYY-MM-DD' */
  entries: Record<string, DayEntries>;
  /** key: `${date}:${meal}` → 갱신 횟수(시드값). */
  variant: Record<string, number>;
}

/**
 * 저장 어댑터 — load/save만 노출한다. UI/스토어는 구현을 모른다.
 * TODO(Phase 1): swap adapter to Supabase meal_entries (RULES R8-3). Interface stays the same.
 */
export interface PlannerPersistence {
  load(): PlannerState;
  save(s: PlannerState): void;
}

const STORAGE_KEY = "planner:v1";

function emptyState(): PlannerState {
  return { entries: {}, variant: {} };
}

/** localStorage 기반 영구 저장 (RULES R8-3 임시 브리지). */
export const localStoragePlannerPersistence: PlannerPersistence = {
  load() {
    if (typeof window === "undefined") return emptyState();
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return emptyState();
      const parsed = JSON.parse(raw) as Partial<PlannerState>;
      return {
        entries: parsed.entries ?? {},
        variant: parsed.variant ?? {},
      };
    } catch {
      return emptyState();
    }
  },
  save(s) {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
    } catch {
      // 저장 실패(쿼터 등)는 조용히 무시 — UI는 메모리 상태로 계속 동작.
    }
  },
};

function variantKey(date: string, meal: MealType): string {
  return `${date}:${meal}`;
}

export interface PlannerContextValue {
  entries: Record<string, DayEntries>;
  /** 해당 (날짜, 끼니)의 확정 엔트리 (없으면 undefined). */
  getEntry(date: string, meal: MealType): Entry | undefined;
  /** 해당 슬롯의 갱신 variant (기본 0). */
  getVariant(date: string, meal: MealType): number;
  /** 확정된 끼니 총 개수. */
  confirmedCount: number;
  /** 메뉴 확정 → 즉시 영구 저장 (upsert) — RULES R8-3. */
  selectMenu(date: string, meal: MealType, menu: SeedMenu): void;
  /** 확정 해제 (변경) — 엔트리 삭제. */
  clearSelection(date: string, meal: MealType): void;
  /** 같은 슬롯에 새 5선지 — variant 증가 (RULES R1-5). */
  refreshSlot(date: string, meal: MealType): void;
}

const PlannerContext = createContext<PlannerContextValue | null>(null);

interface PlannerProviderProps {
  children: ReactNode;
  /** 테스트/스토리북 등에서 어댑터 주입 가능. 기본은 localStorage. */
  persistence?: PlannerPersistence;
}

export function PlannerProvider({
  children,
  persistence = localStoragePlannerPersistence,
}: PlannerProviderProps) {
  const [state, setState] = useState<PlannerState>(() => persistence.load());

  // 모든 변경마다 저장 (RULES R8-3: 화면 이동·새로고침에도 유지).
  useEffect(() => {
    persistence.save(state);
  }, [state, persistence]);

  const selectMenu = useCallback(
    (date: string, meal: MealType, menu: SeedMenu) => {
      setState((prev) => {
        const day = prev.entries[date] ?? {};
        return {
          ...prev,
          entries: {
            ...prev.entries,
            [date]: {
              ...day,
              [meal]: { menuId: menu.id, cuisine: menu.cuisine, menu },
            },
          },
        };
      });
    },
    [],
  );

  const clearSelection = useCallback((date: string, meal: MealType) => {
    setState((prev) => {
      const day = prev.entries[date];
      if (!day || !day[meal]) return prev;
      const nextDay: DayEntries = { ...day };
      delete nextDay[meal];
      const nextEntries = { ...prev.entries };
      if (nextDay.lunch || nextDay.dinner) nextEntries[date] = nextDay;
      else delete nextEntries[date];
      return { ...prev, entries: nextEntries };
    });
  }, []);

  const refreshSlot = useCallback((date: string, meal: MealType) => {
    setState((prev) => {
      const key = variantKey(date, meal);
      return {
        ...prev,
        variant: { ...prev.variant, [key]: (prev.variant[key] ?? 0) + 1 },
      };
    });
  }, []);

  const confirmedCount = useMemo(() => {
    let n = 0;
    for (const day of Object.values(state.entries)) {
      if (day.lunch) n++;
      if (day.dinner) n++;
    }
    return n;
  }, [state.entries]);

  const value = useMemo<PlannerContextValue>(
    () => ({
      entries: state.entries,
      getEntry: (date, meal) => state.entries[date]?.[meal],
      getVariant: (date, meal) => state.variant[variantKey(date, meal)] ?? 0,
      confirmedCount,
      selectMenu,
      clearSelection,
      refreshSlot,
    }),
    [state, confirmedCount, selectMenu, clearSelection, refreshSlot],
  );

  return (
    <PlannerContext.Provider value={value}>{children}</PlannerContext.Provider>
  );
}

export function usePlanner(): PlannerContextValue {
  const ctx = useContext(PlannerContext);
  if (!ctx) {
    throw new Error("usePlanner must be used within <PlannerProvider>");
  }
  return ctx;
}
