import { useState } from "react";
import { useNavigate } from "react-router-dom";
import AppHeader from "../components/AppHeader";
import ScreenShell from "../components/ScreenShell";
import MenuOptionCard from "../components/MenuOptionCard";
import CuisineChip from "../components/CuisineChip";
import CalendarMonth from "../components/CalendarMonth";
import { buildSlotOptions } from "../lib/recommend";
import { usePlanner } from "../lib/plannerStore";
import type { DayEntries } from "../lib/plannerStore";
import { MEAL_LABELS } from "../lib/uiConstants";
import {
  addDaysISO,
  isToday,
  monthDay,
  todayISO,
  weekdayLabel,
} from "../lib/dates";
import type { Cuisine, MealType, SeedMenu } from "@shared/types";

const MEALS: MealType[] = ["lunch", "dinner"];

/**
 * 쿨다운(RULES R1-4) — 해당 (날짜, 끼니) 슬롯에서 제외할 요리종류 계산.
 * ⚠️ 쿨다운 로직의 단일 위치는 이 함수다.
 *  - 전날 단위: 바로 전 날짜의 확정 엔트리(점심·저녁)에서 먹은 요리종류 제외.
 *  - 같은 날 끼니 간: 저녁 슬롯은 같은 날 점심 확정 요리종류도 제외.
 *  - DINEOUT(외식)은 절대 제외하지 않는다.
 */
function cooldownCuisines(
  entries: Record<string, DayEntries>,
  date: string,
  meal: MealType,
): Cuisine[] {
  const excluded = new Set<Cuisine>();
  const prevDay = entries[addDaysISO(date, -1)];
  if (prevDay?.lunch) excluded.add(prevDay.lunch.cuisine);
  if (prevDay?.dinner) excluded.add(prevDay.dinner.cuisine);
  if (meal === "dinner") {
    const lunch = entries[date]?.lunch;
    if (lunch) excluded.add(lunch.cuisine);
  }
  excluded.delete("DINEOUT");
  return [...excluded];
}

function dayLabel(date: string): string {
  if (isToday(date)) return "오늘";
  if (date === addDaysISO(todayISO(), 1)) return "내일";
  if (date === addDaysISO(todayISO(), -1)) return "어제";
  return `${weekdayLabel(date)}요일`;
}

interface SlotCardProps {
  date: string;
  meal: MealType;
}

/**
 * 한 끼 슬롯. 선지에서 고른 뒤 "확정" 버튼으로 저장한다(드래프트 → 확정).
 * 확정된 슬롯은 요약을 보여주고 "수정 / 확정 취소"가 가능하다.
 */
function SlotCard({ date, meal }: SlotCardProps) {
  const navigate = useNavigate();
  const { entries, getEntry, getVariant, selectMenu, clearSelection, refreshSlot } =
    usePlanner();

  const entry = getEntry(date, meal);
  const variant = getVariant(date, meal);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<SeedMenu | null>(null);

  const excludedCuisines = cooldownCuisines(entries, date, meal);
  const options = buildSlotOptions({ excludedCuisines, variant });

  const showOptions = !entry || editing;

  const startEdit = () => {
    setDraft(entry ? entry.menu : null);
    setEditing(true);
  };
  const cancelEdit = () => {
    setEditing(false);
    setDraft(null);
  };
  const confirm = () => {
    if (!draft) return;
    selectMenu(date, meal, draft);
    setEditing(false);
    setDraft(null);
  };
  const cancelConfirm = () => {
    clearSelection(date, meal);
    setEditing(false);
    setDraft(null);
  };
  const refresh = () => {
    refreshSlot(date, meal);
    setDraft(null);
  };

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-3 shadow-sm">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-800">
            {MEAL_LABELS[meal]}
          </span>
          {entry && !editing ? (
            <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
              확정
            </span>
          ) : (
            <span className="text-xs text-gray-400">5개 선지 중 선택</span>
          )}
        </div>
        {showOptions && (
          <button
            type="button"
            onClick={refresh}
            className="rounded-md border border-gray-200 px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50"
          >
            ↻ 갱신
          </button>
        )}
      </div>

      {/* 확정 상태 요약 (편집 중이 아닐 때) */}
      {entry && !editing && (
        <div className="rounded-xl border border-green-200 bg-green-50 p-3">
          <div className="mb-1 flex items-center gap-1.5">
            <CuisineChip cuisine={entry.cuisine} />
            {entry.menu.type === "dineout" && (
              <span className="rounded-full bg-white/70 px-2 py-0.5 text-xs font-medium text-gray-600">
                외식
              </span>
            )}
          </div>
          <p className="mb-3 font-semibold text-gray-900">{entry.menu.name}</p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => navigate(`/menu/${entry.menuId}`)}
              className="flex-1 rounded-lg border border-gray-200 bg-white py-2 text-xs font-semibold text-blue-600 hover:bg-gray-50"
            >
              상세 보기
            </button>
            <button
              type="button"
              onClick={startEdit}
              className="flex-1 rounded-lg border border-gray-200 bg-white py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
            >
              수정
            </button>
            <button
              type="button"
              onClick={cancelConfirm}
              className="flex-1 rounded-lg border border-red-200 bg-white py-2 text-xs font-semibold text-red-600 hover:bg-red-50"
            >
              확정 취소
            </button>
          </div>
        </div>
      )}

      {/* 선지 선택 + 확정 버튼 */}
      {showOptions && (
        <>
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            {options.map((menu) => (
              <div key={menu.id} className="w-44 shrink-0">
                <MenuOptionCard
                  menu={menu}
                  selected={draft?.id === menu.id}
                  onSelect={() => setDraft(menu)}
                  onDetail={() => navigate(`/menu/${menu.id}`)}
                />
              </div>
            ))}
          </div>

          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={confirm}
              disabled={!draft}
              className={`flex-1 rounded-lg py-2.5 text-sm font-bold transition ${
                draft
                  ? "bg-gray-900 text-white hover:bg-gray-800"
                  : "cursor-not-allowed bg-gray-100 text-gray-400"
              }`}
            >
              {draft ? `'${draft.name}' 확정` : "메뉴를 선택하세요"}
            </button>
            {editing && (
              <button
                type="button"
                onClick={cancelEdit}
                className="rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
              >
                취소
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default function WeekPlanScreen() {
  const { entries, confirmedCount } = usePlanner();
  const [activeDate, setActiveDate] = useState(() => todayISO());
  const [view, setView] = useState<"day" | "calendar">("day");

  return (
    <ScreenShell>
      <AppHeader
        title="식단"
        subtitle={`${confirmedCount}끼 확정`}
        action={
          <button
            type="button"
            onClick={() => setView((v) => (v === "day" ? "calendar" : "day"))}
            className="rounded-full border border-gray-200 px-3 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50"
          >
            {view === "day" ? "📅 달력" : "✕ 닫기"}
          </button>
        }
      />

      {view === "calendar" ? (
        <CalendarMonth
          selectedDate={activeDate}
          entries={entries}
          onPickDate={(d) => {
            setActiveDate(d);
            setView("day");
          }}
        />
      ) : (
        <>
          {/* 날짜 네비게이션 (전날 / 날짜 / 다음날) */}
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-100 bg-gray-50/95 px-3 py-2 backdrop-blur">
            <button
              type="button"
              onClick={() => setActiveDate((d) => addDaysISO(d, -1))}
              className="flex h-9 w-9 items-center justify-center rounded-full text-gray-500 hover:bg-gray-200"
              aria-label="전날"
            >
              ◀
            </button>

            <button
              type="button"
              onClick={() => setView("calendar")}
              className="flex flex-col items-center"
            >
              <span className="flex items-baseline gap-1.5">
                <span className="text-base font-bold text-gray-900">
                  {dayLabel(activeDate)}
                </span>
                <span className="text-xs text-gray-400">
                  {monthDay(activeDate)} ({weekdayLabel(activeDate)})
                </span>
              </span>
              {!isToday(activeDate) && (
                <span className="text-[11px] text-blue-600">달력 열기</span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveDate((d) => addDaysISO(d, 1))}
              className="flex h-9 w-9 items-center justify-center rounded-full text-gray-500 hover:bg-gray-200"
              aria-label="다음날"
            >
              ▶
            </button>
          </div>

          {!isToday(activeDate) && (
            <div className="px-4 pt-2">
              <button
                type="button"
                onClick={() => setActiveDate(todayISO())}
                className="rounded-full bg-gray-900 px-3 py-1 text-xs font-medium text-white"
              >
                오늘로
              </button>
            </div>
          )}

          <div className="space-y-3 px-4 py-3">
            {MEALS.map((meal) => (
              <SlotCard key={`${activeDate}-${meal}`} date={activeDate} meal={meal} />
            ))}
          </div>
        </>
      )}
    </ScreenShell>
  );
}
