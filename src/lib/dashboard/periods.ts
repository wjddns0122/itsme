import { addDays, seoulToday } from "@/lib/dates";

// Dashboard periods in Korean time (docs/01-prd.md F8-1). Returned as ISO instants for queries.

const at = (day: string) => new Date(`${day}T00:00:00+09:00`).toISOString();

export type DashboardPeriods = {
  todayStart: string;
  monthStart: string;
  lastMonthStart: string;
  weekStart: string;
  /** The last 7 Seoul days, oldest first, ending today. */
  days: string[];
};

export function dashboardPeriods(now: Date): DashboardPeriods {
  const today = seoulToday(now);
  const [y, m] = today.split("-").map(Number);
  const month = `${y}-${String(m).padStart(2, "0")}-01`;
  const lastMonth = m === 1 ? `${y - 1}-12-01` : `${y}-${String(m - 1).padStart(2, "0")}-01`;
  // Monday-based week, like a Korean calendar.
  const weekday = (new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7;
  return {
    todayStart: at(today),
    monthStart: at(month),
    lastMonthStart: at(lastMonth),
    weekStart: at(addDays(today, -weekday)),
    days: Array.from({ length: 7 }, (_, i) => addDays(today, i - 6)),
  };
}

/** 반환율 = 이번 달 등록된 습득물 중 반환 완료 수 / 이번 달 등록된 습득물 수 (F8-1). */
export function returnRate(returned: number, registered: number): number | null {
  return registered > 0 ? Math.round((returned / registered) * 100) : null;
}
