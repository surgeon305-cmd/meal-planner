import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import AppHeader from "../components/AppHeader";
import ScreenShell from "../components/ScreenShell";
import MenuOptionCard from "../components/MenuOptionCard";
import { mockWeekPlan } from "../lib/mockData";
import { DAY_LABELS, MEAL_LABELS } from "../lib/uiConstants";
import type { MealSlot } from "../lib/viewTypes";

// TODO(Phase 1): mockWeekPlan → useWeekPlan() (React Query). 선택/갱신은 서버 반영.

function slotKey(slot: MealSlot): string {
  return `${slot.dayIndex}-${slot.meal}`;
}

function formatDate(weekStart: string, dayIndex: number): string {
  const d = new Date(weekStart);
  d.setDate(d.getDate() + dayIndex);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export default function WeekPlanScreen() {
  const navigate = useNavigate();
  const plan = mockWeekPlan;

  // 슬롯별 현재 선지 세트 인덱스 (갱신용).
  const [setIndex, setSetIndex] = useState<Record<string, number>>({});
  // 슬롯별 선택(확정)된 메뉴 id.
  const [selected, setSelected] = useState<Record<string, string>>({});

  const selectedCount = Object.keys(selected).length;

  const refresh = (slot: MealSlot) => {
    const key = slotKey(slot);
    setSetIndex((prev) => ({
      ...prev,
      [key]: ((prev[key] ?? 0) + 1) % slot.optionSets.length,
    }));
    // 갱신하면 이전 선택은 해제 (새 5선지 기준).
    setSelected((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const toggleSelect = (key: string, menuId: string) => {
    setSelected((prev) => {
      const next = { ...prev };
      if (next[key] === menuId) delete next[key];
      else next[key] = menuId;
      return next;
    });
  };

  // 요일별로 슬롯 묶기.
  const slotsByDay = useMemo(() => {
    const map = new Map<number, MealSlot[]>();
    for (const slot of plan.slots) {
      const list = map.get(slot.dayIndex) ?? [];
      list.push(slot);
      map.set(slot.dayIndex, list);
    }
    return [...map.entries()].sort((a, b) => a[0] - b[0]);
  }, [plan.slots]);

  return (
    <ScreenShell>
      <AppHeader
        title="이번 주 식단"
        subtitle={`${plan.weekStart} 시작 · 14칸 중 ${selectedCount}칸 선택`}
        action={
          <span className="rounded-full bg-gray-900 px-2.5 py-1 text-xs font-semibold text-white">
            {selectedCount}/14
          </span>
        }
      />

      <div className="space-y-5 px-4 py-4">
        {slotsByDay.map(([dayIndex, slots]) => (
          <section key={dayIndex}>
            <h2 className="mb-2 flex items-baseline gap-2">
              <span className="text-sm font-bold text-gray-900">
                {DAY_LABELS[dayIndex]}요일
              </span>
              <span className="text-xs text-gray-400">
                {formatDate(plan.weekStart, dayIndex)}
              </span>
            </h2>

            <div className="space-y-3">
              {slots.map((slot) => {
                const key = slotKey(slot);
                const idx = setIndex[key] ?? 0;
                const options = slot.optionSets[idx];
                const selectedId = selected[key];
                return (
                  <div
                    key={key}
                    className="rounded-2xl border border-gray-200 bg-white p-3 shadow-sm"
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-gray-800">
                          {MEAL_LABELS[slot.meal]}
                        </span>
                        {selectedId ? (
                          <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                            선택 완료
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">5개 선지</span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => refresh(slot)}
                        className="rounded-md border border-gray-200 px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50"
                      >
                        ↻ 갱신
                      </button>
                    </div>

                    <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
                      {options.map((menu) => (
                        <div key={menu.id} className="w-44 shrink-0">
                          <MenuOptionCard
                            menu={menu}
                            selected={selectedId === menu.id}
                            onSelect={() => toggleSelect(key, menu.id)}
                            onDetail={() => navigate(`/menu/${menu.id}`)}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </ScreenShell>
  );
}
