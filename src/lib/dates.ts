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

/** Value for <input type="datetime-local"> showing the current Seoul time: "2026-11-25T14:32". */
export function seoulNowLocalInput(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: SEOUL, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

/** A datetime-local value typed in Korea ("2026-11-25T14:32") as an ISO instant, or null if malformed. */
export function seoulLocalToIso(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const date = new Date(`${value}:00+09:00`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function addDaysToInstant(iso: string, days: number): string {
  return new Date(new Date(iso).getTime() + days * 86_400_000).toISOString();
}

/** "11월 25일 14:32" in Seoul time. */
export function formatSeoulDateTime(iso: string): string {
  const local = seoulNowLocalInput(new Date(iso));
  const [date, time] = local.split("T");
  return `${formatMonthDay(date)} ${time}`;
}

/** "2027년 11월 25일" in Seoul time. */
export function formatSeoulFullDate(iso: string): string {
  const [y, m, d] = seoulToday(new Date(iso)).split("-").map(Number);
  return `${y}년 ${m}월 ${d}일`;
}

/** Seoul calendar day of an instant: "2026-11-25". */
export function seoulDate(iso: string): string {
  return seoulToday(new Date(iso));
}

/** Seoul wall-clock time of an instant: "14:32". */
export function seoulClock(iso: string): string {
  return seoulNowLocalInput(new Date(iso)).split("T")[1];
}
