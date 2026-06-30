// =============================================================================
// PlannerStore — 날짜 기반 확정 엔트리의 영구 저장소.
// ENTRIES는 Supabase `meal_entries`가 단일 출처(RULES R8-3). 슬롯 갱신 variant만
// 기기별 UI 상태로 localStorage에 남긴다.
//
// 소비 화면(WeekPlan/History/ShoppingList/MenuDetail)이 쓰는 PlannerContextValue
// 인터페이스는 그대로 유지한다.
// =============================================================================
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import type { Cuisine, MealType, SeedMenu } from "@shared/types";
import { supabase } from "./supabaseClient";
import { useAuth } from "./auth";
import { useActivePlanId } from "./plans";

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

/** key: `${date}:${meal}` → 갱신 횟수(시드값). */
type VariantMap = Record<string, number>;

/** Supabase `meal_entries` 행(필요 컬럼만). */
interface MealEntryRow {
  entry_date: string;
  meal: MealType;
  menu_id: string;
  cuisine: Cuisine;
  menu: SeedMenu;
}

const VARIANT_KEY = "planner-variant:v1";

function variantKey(date: string, meal: MealType): string {
  return `${date}:${meal}`;
}

function loadVariant(): VariantMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(VARIANT_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as VariantMap;
  } catch {
    return {};
  }
}

function saveVariant(v: VariantMap): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(VARIANT_KEY, JSON.stringify(v));
  } catch {
    // 저장 실패(쿼터 등)는 조용히 무시.
  }
}

export interface PlannerContextValue {
  entries: Record<string, DayEntries>;
  /** 해당 (날짜, 끼니)의 확정 엔트리 (없으면 undefined). */
  getEntry(date: string, meal: MealType): Entry | undefined;
  /** 해당 슬롯의 갱신 variant (기본 0). */
  getVariant(date: string, meal: MealType): number;
  /** 확정된 끼니 총 개수. */
  confirmedCount: number;
  /** 엔트리 로딩 중 여부 (소비자는 무시해도 됨). */
  loading: boolean;
  /** 메뉴 확정 → 즉시 영구 저장 (upsert) — RULES R8-3. */
  selectMenu(date: string, meal: MealType, menu: SeedMenu): void;
  /** 확정 해제 (변경) — 엔트리 삭제. */
  clearSelection(date: string, meal: MealType): void;
  /** 같은 슬롯에 새 5선지 — variant 증가 (RULES R1-5). */
  refreshSlot(date: string, meal: MealType): void;
}

const PlannerContext = createContext<PlannerContextValue | null>(null);

export function PlannerProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  // 엔트리는 활성 plan에 속한다 — plan이 바뀌면 다시 로드한다 (공유 식단 지원).
  const activePlanId = useActivePlanId();
  const [entries, setEntries] = useState<Record<string, DayEntries>>({});
  const [variant, setVariant] = useState<VariantMap>(() => loadVariant());
  const [loading, setLoading] = useState(false);

  // 롤백용 최신 엔트리 스냅샷 (비동기 쓰기 실패 시 복구).
  const entriesRef = useRef(entries);
  useEffect(() => {
    entriesRef.current = entries;
  }, [entries]);

  // 사용자/활성 plan 변경 시 해당 plan의 meal_entries 전체 로드 + Realtime 구독.
  // 비로그인 또는 활성 plan 없음 → 빈 상태, 구독 없음. (RULES R10)
  useEffect(() => {
    if (!user || !activePlanId) {
      setEntries({});
      setLoading(false);
      return;
    }
    const planId = activePlanId;
    let mounted = true;

    // entries를 채우는 select를 재실행한다 (초기 로드 + Realtime 변경 반영).
    const reload = () => {
      void supabase
        .from("meal_entries")
        .select("entry_date, meal, menu_id, cuisine, menu")
        .eq("plan_id", planId)
        .then(({ data, error }) => {
          if (!mounted) return;
          if (error) {
            console.error("[planner] load failed", error.message);
            setEntries({});
            setLoading(false);
            return;
          }
          const next: Record<string, DayEntries> = {};
          for (const row of (data ?? []) as MealEntryRow[]) {
            const day = next[row.entry_date] ?? {};
            day[row.meal] = {
              menuId: row.menu_id,
              cuisine: row.cuisine,
              menu: row.menu,
            };
            next[row.entry_date] = day;
          }
          setEntries(next);
          setLoading(false);
        });
    };

    setLoading(true);
    reload();

    // 다른 클라이언트가 이 plan의 엔트리를 바꾸면 다시 로드한다 (공유 식단 동기화).
    const channel = supabase
      .channel("plan-entries:" + planId)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "meal_entries",
          filter: "plan_id=eq." + planId,
        },
        () => {
          void reload();
        },
      )
      .subscribe();

    return () => {
      mounted = false;
      void supabase.removeChannel(channel);
    };
  }, [user, activePlanId]);

  // variant는 기기별 UI 상태 — localStorage에만 유지.
  useEffect(() => {
    saveVariant(variant);
  }, [variant]);

  const selectMenu = useCallback(
    (date: string, meal: MealType, menu: SeedMenu) => {
      if (!user || !activePlanId) return;
      const prevDay = entriesRef.current[date];
      const entry: Entry = {
        menuId: menu.id,
        cuisine: menu.cuisine,
        menu,
      };
      // 낙관적 업데이트.
      setEntries((prev) => ({
        ...prev,
        [date]: { ...(prev[date] ?? {}), [meal]: entry },
      }));

      void supabase
        .from("meal_entries")
        .upsert(
          {
            plan_id: activePlanId,
            user_id: user.id,
            entry_date: date,
            meal,
            menu_id: menu.id,
            cuisine: menu.cuisine,
            menu,
            servings: null,
          },
          { onConflict: "plan_id,entry_date,meal" },
        )
        .then(({ error }) => {
          if (!error) return;
          console.error("[planner] upsert failed, rolling back", error.message);
          // 롤백: 이전 day 상태로 복구.
          setEntries((prev) => {
            const next = { ...prev };
            if (prevDay) next[date] = prevDay;
            else delete next[date];
            return next;
          });
        });
    },
    [user, activePlanId],
  );

  const clearSelection = useCallback(
    (date: string, meal: MealType) => {
      if (!user || !activePlanId) return;
      const prevDay = entriesRef.current[date];
      if (!prevDay || !prevDay[meal]) return;
      // 낙관적 삭제.
      setEntries((prev) => {
        const day = prev[date];
        if (!day) return prev;
        const nextDay: DayEntries = { ...day };
        delete nextDay[meal];
        const next = { ...prev };
        if (nextDay.lunch || nextDay.dinner) next[date] = nextDay;
        else delete next[date];
        return next;
      });

      void supabase
        .from("meal_entries")
        .delete()
        .match({ plan_id: activePlanId, entry_date: date, meal })
        .then(({ error }) => {
          if (!error) return;
          console.error("[planner] delete failed, rolling back", error.message);
          setEntries((prev) => ({ ...prev, [date]: prevDay }));
        });
    },
    [user, activePlanId],
  );

  const refreshSlot = useCallback((date: string, meal: MealType) => {
    const key = variantKey(date, meal);
    setVariant((prev) => ({ ...prev, [key]: (prev[key] ?? 0) + 1 }));
  }, []);

  const confirmedCount = useMemo(() => {
    let n = 0;
    for (const day of Object.values(entries)) {
      if (day.lunch) n++;
      if (day.dinner) n++;
    }
    return n;
  }, [entries]);

  const value = useMemo<PlannerContextValue>(
    () => ({
      entries,
      getEntry: (date, meal) => entries[date]?.[meal],
      getVariant: (date, meal) => variant[variantKey(date, meal)] ?? 0,
      confirmedCount,
      loading,
      selectMenu,
      clearSelection,
      refreshSlot,
    }),
    [entries, variant, confirmedCount, loading, selectMenu, clearSelection, refreshSlot],
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
