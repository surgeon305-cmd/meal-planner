/** 날짜 유틸 — RULES R8 (날짜 기반 모델). 모든 날짜는 로컬 기준 ISO YYYY-MM-DD. */

const WEEKDAY_KR = ["일", "월", "화", "수", "목", "금", "토"] as const;

/** Date → 'YYYY-MM-DD' (로컬). */
export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** 'YYYY-MM-DD' → Date (로컬 정오 기준, DST 안전). */
export function fromISODate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d, 12, 0, 0, 0);
}

export function todayISO(): string {
  return toISODate(new Date());
}

export function addDaysISO(iso: string, days: number): string {
  const d = fromISODate(iso);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

/** 오늘 포함 향후 count일의 ISO 날짜 배열 — RULES R8-2 (오늘 + 향후 13일 = count 14). */
export function upcomingDates(count: number, startISO = todayISO()): string[] {
  return Array.from({ length: count }, (_, i) => addDaysISO(startISO, i));
}

/** 요일 라벨 (월/화/...). */
export function weekdayLabel(iso: string): string {
  return WEEKDAY_KR[fromISODate(iso).getDay()];
}

/** 0=월 ... 6=일 (쿨다운 등 내부 계산용 dayIndex) — RULES R0. */
export function dayIndexMonFirst(iso: string): number {
  return (fromISODate(iso).getDay() + 6) % 7;
}

/** 'M/D' 짧은 표기. */
export function monthDay(iso: string): string {
  const d = fromISODate(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

/** 해당 날짜가 속한 주의 월요일 ISO (주간 그룹 키) — RULES R8-5. */
export function mondayOf(iso: string): string {
  return addDaysISO(iso, -dayIndexMonFirst(iso));
}

export function isToday(iso: string): boolean {
  return iso === todayISO();
}

export function isPast(iso: string): boolean {
  return iso < todayISO();
}
