import { useNavigate } from "react-router-dom";
import AppHeader from "../components/AppHeader";
import ScreenShell from "../components/ScreenShell";
import MenuOptionCard from "../components/MenuOptionCard";
import CuisineChip from "../components/CuisineChip";
import { buildSlotOptions } from "../lib/recommend";
import { usePlanner } from "../lib/plannerStore";
import type { DayEntries } from "../lib/plannerStore";
import { MEAL_LABELS } from "../lib/uiConstants";
import {
  addDaysISO,
  fromISODate,
  isToday,
  monthDay,
  mondayOf,
  todayISO,
  upcomingDates,
  weekdayLabel,
} from "../lib/dates";
import type { Cuisine, MealType } from "@shared/types";

/** 편집 가능 범위(horizon): 오늘 + 향후 13일 = 14일 (RULES R8-2). */
const HORIZON_DAYS = 14;
const MEALS: MealType[] = ["lunch", "dinner"];

/**
 * 쿨다운(RULES R1-4) — 해당 (날짜, 끼니) 슬롯에서 제외할 요리종류 계산.
 * ⚠️ 쿨다운 로직의 단일 위치는 이 함수다.
 *  - 전날 단위: 바로 전 날짜의 확정 엔트리(점심·저녁)에서 먹은 요리종류 제외.
 *    (전날 엔트리가 없으면 = 거른 날 → 쿨다운 없음.)
 *  - 같은 날 끼니 간: 저녁 슬롯은 같은 날 점심에 확정한 요리종류도 제외.
 *  - DINEOUT(외식)은 절대 제외하지 않는다 (매 끼 1선지 유지).
 */
function cooldownCuisines(
  entries: Record<string, DayEntries>,
  date: string,
  meal: MealType,
): Cuisine[] {
  const excluded = new Set<Cuisine>();

  const prevDate = addDaysISO(date, -1);
  const prevDay = entries[prevDate];
  if (prevDay?.lunch) excluded.add(prevDay.lunch.cuisine);
  if (prevDay?.dinner) excluded.add(prevDay.dinner.cuisine);

  if (meal === "dinner") {
    const lunch = entries[date]?.lunch;
    if (lunch) excluded.add(lunch.cuisine);
  }

  // 외식은 쿨다운 대상에서 제외하지 않는다.
  excluded.delete("DINEOUT");
  return [...excluded];
}

function dayLabel(date: string): string {
  if (isToday(date)) return "오늘";
  if (date === addDaysISO(todayISO(), 1)) return "내일";
  return `${weekdayLabel(date)}요일`;
}

/** 주(월요일 시작) 그룹 헤더 라벨 — 이번 주/다음 주/그 외 (RULES R8-5). */
function weekLabel(monday: string, todayMonday: string): string {
  const diffDays = Math.round(
    (fromISODate(monday).getTime() - fromISODate(todayMonday).getTime()) /
      86_400_000,
  );
  const w = Math.round(diffDays / 7);
  if (w === 0) return "이번 주";
  if (w === 1) return "다음 주";
  return `${monthDay(monday)} 주`;
}

interface SlotCardProps {
  date: string;
  meal: MealType;
}

function SlotCard({ date, meal }: SlotCardProps) {
  const navigate = useNavigate();
  const { entries, getEntry, getVariant, selectMenu, clearSelection, refreshSlot } =
    usePlanner();

  const entry = getEntry(date, meal);
  const variant = getVariant(date, meal);
  const excludedCuisines = cooldownCuisines(entries, date, meal);
  const options = buildSlotOptions({ excludedCuisines, variant });

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-3 shadow-sm">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-800">
            {MEAL_LABELS[meal]}
          </span>
          {entry ? (
            <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
              확정
            </span>
          ) : (
            <span className="text-xs text-gray-400">5개 선지</span>
          )}
        </div>
        <button
          type="button"
          onClick={() => refreshSlot(date, meal)}
          className="rounded-md border border-gray-200 px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50"
        >
          ↻ 갱신
        </button>
      </div>

      {/* 확정된 슬롯: 선택 메뉴를 크게 보여주고 변경 어포던스 제공. */}
      {entry && (
        <div className="mb-3 flex items-center justify-between gap-2 rounded-xl border border-green-200 bg-green-50 p-3">
          <div className="min-w-0">
            <div className="mb-1 flex items-center gap-1.5">
              <CuisineChip cuisine={entry.cuisine} />
              {entry.menu.type === "dineout" && (
                <span className="rounded-full bg-white/70 px-2 py-0.5 text-xs font-medium text-gray-600">
                  외식
                </span>
              )}
            </div>
            <p className="truncate font-semibold text-gray-900">
              {entry.menu.name}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={() => navigate(`/menu/${entry.menuId}`)}
              className="rounded-md px-2 py-1 text-xs font-medium text-blue-600 hover:bg-white/60"
            >
              상세 →
            </button>
            <button
              type="button"
              onClick={() => clearSelection(date, meal)}
              className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50"
            >
              변경
            </button>
          </div>
        </div>
      )}

      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {options.map((menu) => (
          <div key={menu.id} className="w-44 shrink-0">
            <MenuOptionCard
              menu={menu}
              selected={entry?.menuId === menu.id}
              onSelect={() => selectMenu(date, meal, menu)}
              onDetail={() => navigate(`/menu/${menu.id}`)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function WeekPlanScreen() {
  const { confirmedCount } = usePlanner();
  const dates = upcomingDates(HORIZON_DAYS);
  const todayMonday = mondayOf(todayISO());

  let lastWeek = "";

  return (
    <ScreenShell>
      <AppHeader
        title="식단"
        subtitle={`오늘부터 2주 · ${confirmedCount}끼 확정`}
        action={
          <span className="rounded-full bg-gray-900 px-2.5 py-1 text-xs font-semibold text-white">
            {confirmedCount}끼
          </span>
        }
      />

      <div className="space-y-5 px-4 py-4">
        {dates.map((date) => {
          const monday = mondayOf(date);
          const showWeekHeading = monday !== lastWeek;
          lastWeek = monday;
          const today = isToday(date);

          return (
            <div key={date}>
              {showWeekHeading && (
                <h2 className="mb-2 mt-1 text-xs font-bold uppercase tracking-wide text-gray-400">
                  {weekLabel(monday, todayMonday)}
                </h2>
              )}

              <section
                className={`rounded-2xl ${
                  today ? "ring-2 ring-gray-900" : ""
                }`}
              >
                <h3 className="mb-2 flex items-baseline gap-2 px-1">
                  <span
                    className={`text-sm font-bold ${
                      today ? "text-gray-900" : "text-gray-700"
                    }`}
                  >
                    {dayLabel(date)}
                  </span>
                  <span className="text-xs text-gray-400">{monthDay(date)}</span>
                </h3>

                <div className="space-y-3">
                  {MEALS.map((meal) => (
                    <SlotCard key={meal} date={date} meal={meal} />
                  ))}
                </div>
              </section>
            </div>
          );
        })}
      </div>
    </ScreenShell>
  );
}
