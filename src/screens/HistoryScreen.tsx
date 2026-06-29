import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import AppHeader from "../components/AppHeader";
import ScreenShell from "../components/ScreenShell";
import CuisineChip from "../components/CuisineChip";
import { usePlanner } from "../lib/plannerStore";
import type { Entry } from "../lib/plannerStore";
import type { MealType } from "@shared/types";
import {
  mondayOf,
  monthDay,
  weekdayLabel,
  isToday,
  addDaysISO,
} from "../lib/dates";
import { MEAL_LABELS } from "../lib/uiConstants";

// 주 단위 누적 히스토리 — RULES R8-5. plannerStore 확정 엔트리에서 파생.

interface DayRow {
  date: string;
  lunch?: Entry;
  dinner?: Entry;
}
interface WeekGroup {
  monday: string;
  days: DayRow[];
  count: number;
}

const MEALS: MealType[] = ["lunch", "dinner"];

function weekRangeLabel(monday: string): string {
  return `${monthDay(monday)} ~ ${monthDay(addDaysISO(monday, 6))}`;
}

export default function HistoryScreen() {
  const navigate = useNavigate();
  const { entries } = usePlanner();

  const weeks = useMemo<WeekGroup[]>(() => {
    const byWeek = new Map<string, Map<string, DayRow>>();
    for (const [date, day] of Object.entries(entries)) {
      if (!day.lunch && !day.dinner) continue;
      const wk = mondayOf(date);
      const days = byWeek.get(wk) ?? new Map<string, DayRow>();
      days.set(date, { date, lunch: day.lunch, dinner: day.dinner });
      byWeek.set(wk, days);
    }
    return [...byWeek.entries()]
      .sort((a, b) => (a[0] < b[0] ? 1 : -1)) // 최신 주 먼저
      .map(([monday, days]) => {
        const rows = [...days.values()].sort((a, b) =>
          a.date < b.date ? -1 : 1,
        );
        const count = rows.reduce(
          (n, r) => n + (r.lunch ? 1 : 0) + (r.dinner ? 1 : 0),
          0,
        );
        return { monday, days: rows, count };
      });
  }, [entries]);

  const totalConfirmed = weeks.reduce((n, w) => n + w.count, 0);

  return (
    <ScreenShell>
      <AppHeader
        title="히스토리"
        subtitle={`지금까지 확정한 식단 · 총 ${totalConfirmed}끼`}
      />

      <div className="space-y-5 px-4 py-4">
        {weeks.map((week) => (
          <section key={week.monday}>
            <h2 className="mb-2 flex items-baseline justify-between">
              <span className="text-sm font-bold text-gray-900">
                {weekRangeLabel(week.monday)}
              </span>
              <span className="text-xs text-gray-400">{week.count}끼</span>
            </h2>

            <div className="space-y-2">
              {week.days.map((row) => (
                <div
                  key={row.date}
                  className="rounded-2xl border border-gray-200 bg-white p-3 shadow-sm"
                >
                  <div className="mb-2 flex items-center gap-2">
                    <span className="text-sm font-semibold text-gray-800">
                      {weekdayLabel(row.date)} {monthDay(row.date)}
                    </span>
                    {isToday(row.date) && (
                      <span className="rounded-full bg-gray-900 px-2 py-0.5 text-xs font-medium text-white">
                        오늘
                      </span>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    {MEALS.map((meal) => {
                      const entry = row[meal];
                      return (
                        <div
                          key={meal}
                          className="flex items-center gap-2 text-sm"
                        >
                          <span className="w-8 shrink-0 text-xs text-gray-400">
                            {MEAL_LABELS[meal]}
                          </span>
                          {entry ? (
                            <button
                              type="button"
                              onClick={() => navigate(`/menu/${entry.menuId}`)}
                              className="flex flex-1 items-center gap-2 text-left"
                            >
                              <CuisineChip cuisine={entry.cuisine} />
                              <span className="text-gray-800">
                                {entry.menu.name}
                              </span>
                            </button>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}

        {weeks.length === 0 && (
          <p className="py-10 text-center text-sm text-gray-500">
            아직 확정한 식단이 없어요. 식단에서 메뉴를 골라 보세요.
          </p>
        )}
      </div>
    </ScreenShell>
  );
}
