import { useState } from "react";
import type { DayEntries } from "../lib/plannerStore";
import {
  addMonthsISO,
  firstOfMonthISO,
  isSameMonth,
  isToday,
  monthGridDates,
  monthLabel,
} from "../lib/dates";

const WEEKDAY_HEADERS = ["월", "화", "수", "목", "금", "토", "일"] as const;

interface CalendarMonthProps {
  /** 현재 선택된 날짜 (강조 표시). */
  selectedDate: string;
  /** 확정 엔트리 — 날짜별 점/표시용. */
  entries: Record<string, DayEntries>;
  /** 날짜 클릭 시. */
  onPickDate: (date: string) => void;
}

/** 큰 달력(월 그리드). 날짜 클릭으로 해당 날짜 선택 — 점심/저녁 확정 여부를 점으로 표시. */
export default function CalendarMonth({
  selectedDate,
  entries,
  onPickDate,
}: CalendarMonthProps) {
  const [anchor, setAnchor] = useState(() => firstOfMonthISO(selectedDate));
  const cells = monthGridDates(anchor);

  return (
    <div className="px-4 py-4">
      {/* 월 네비게이션 */}
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setAnchor((a) => addMonthsISO(a, -1))}
          className="flex h-9 w-9 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100"
          aria-label="이전 달"
        >
          ◀
        </button>
        <span className="text-base font-bold text-gray-900">
          {monthLabel(anchor)}
        </span>
        <button
          type="button"
          onClick={() => setAnchor((a) => addMonthsISO(a, 1))}
          className="flex h-9 w-9 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100"
          aria-label="다음 달"
        >
          ▶
        </button>
      </div>

      {/* 요일 헤더 */}
      <div className="mb-1 grid grid-cols-7 text-center text-xs font-medium text-gray-400">
        {WEEKDAY_HEADERS.map((w) => (
          <div key={w} className="py-1">
            {w}
          </div>
        ))}
      </div>

      {/* 날짜 셀 */}
      <div className="grid grid-cols-7 gap-1">
        {cells.map((date) => {
          const inMonth = isSameMonth(date, anchor);
          const today = isToday(date);
          const selected = date === selectedDate;
          const day = entries[date];
          const dayNum = Number(date.slice(8, 10));

          return (
            <button
              key={date}
              type="button"
              onClick={() => onPickDate(date)}
              className={`flex aspect-square flex-col items-center justify-center rounded-xl text-sm transition-colors ${
                selected
                  ? "bg-gray-900 text-white"
                  : today
                    ? "bg-gray-100 font-bold text-gray-900"
                    : inMonth
                      ? "text-gray-800 hover:bg-gray-100"
                      : "text-gray-300 hover:bg-gray-50"
              }`}
            >
              <span>{dayNum}</span>
              {/* 확정 표시: 점심/저녁 점 */}
              <span className="mt-0.5 flex h-1.5 items-center gap-0.5">
                {day?.lunch && (
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      selected ? "bg-white" : "bg-green-500"
                    }`}
                  />
                )}
                {day?.dinner && (
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      selected ? "bg-white/70" : "bg-amber-500"
                    }`}
                  />
                )}
              </span>
            </button>
          );
        })}
      </div>

      <p className="mt-3 flex items-center justify-center gap-3 text-xs text-gray-400">
        <span className="flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-green-500" /> 점심
        </span>
        <span className="flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> 저녁
        </span>
      </p>
    </div>
  );
}
