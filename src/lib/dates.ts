// Dates people pick are Korean calendar days (docs/04-architecture.md: lost_from/lost_to are Asia/Seoul).
// Kept as "YYYY-MM-DD" strings so they never shift with the server's time zone.

const SEOUL = "Asia/Seoul";

export function seoulToday(now: Date = new Date()): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", { timeZone: SEOUL, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

/** Adds whole days to a YYYY-MM-DD date. */
export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d + days));
  return utc.toISOString().slice(0, 10);
}

export function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return addDays(value, 0) === value;
}

/** "11월 24일" */
export function formatMonthDay(date: string): string {
  const [, m, d] = date.split("-").map(Number);
  return `${m}월 ${d}일`;
}
