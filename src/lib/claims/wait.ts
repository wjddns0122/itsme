import ko from "../../../messages/ko.json";

const w = ko.admin.claims.wait;
const MINUTE = 60_000;

/** A-06 대기 시간: "20분", "1시간 48분", "4시간", "1일". */
export function formatWait(fromIso: string, now: Date): string {
  const minutes = Math.max(0, Math.floor((now.getTime() - new Date(fromIso).getTime()) / MINUTE));
  if (minutes < 60) return w.minutes.replace("{n}", String(minutes));
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    const rest = minutes % 60;
    return rest ? w.hours.replace("{h}", String(hours)).replace("{m}", String(rest)) : w.hoursOnly.replace("{h}", String(hours));
  }
  return w.days.replace("{n}", String(Math.floor(hours / 24)));
}

/** A day or more: shown in red (Figma A-06 list). */
export function isLongWait(fromIso: string, now: Date): boolean {
  return now.getTime() - new Date(fromIso).getTime() >= 24 * 60 * MINUTE;
}
