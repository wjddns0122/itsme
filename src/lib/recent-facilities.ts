import { z } from "zod";
import { FACILITY_TYPES, type PublicFacility } from "@/lib/facilities/public";

// "최근 본 시설" lives only in this browser (FL-028). Storage can be missing, full or blocked,
// so every read and write is wrapped and the screen works without it.
export const RECENT_FACILITIES_KEY = "itsme.recentFacilities";
const MAX_RECENT = 3;

const RecentSchema = z.array(
  z.object({
    slug: z.string().min(1),
    name: z.string().min(1),
    region: z.string(),
    type: z.enum(FACILITY_TYPES),
  }),
);

export function parseRecentFacilities(raw: string | null): PublicFacility[] {
  if (!raw) return [];
  try {
    const parsed = RecentSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data.slice(0, MAX_RECENT) : [];
  } catch {
    return [];
  }
}

/** Newest first, no duplicates, at most three. */
export function addRecentFacility(list: readonly PublicFacility[], facility: PublicFacility): PublicFacility[] {
  return [facility, ...list.filter((f) => f.slug !== facility.slug)].slice(0, MAX_RECENT);
}

export function readRecentFacilitiesRaw(): string | null {
  try {
    return window.localStorage.getItem(RECENT_FACILITIES_KEY);
  } catch {
    return null;
  }
}

/** Called from the facility page (P-02) when someone opens a facility. */
export function rememberFacility(facility: PublicFacility): void {
  try {
    const next = addRecentFacility(parseRecentFacilities(readRecentFacilitiesRaw()), facility);
    window.localStorage.setItem(RECENT_FACILITIES_KEY, JSON.stringify(next));
  } catch {
    // Storage unavailable: nothing to remember, nothing to break.
  }
}
