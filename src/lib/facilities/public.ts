import { z } from "zod";
import type { IconName } from "@/components/icon";
import type { Database } from "@/lib/supabase/types";

export type FacilityType = Database["public"]["Enums"]["facility_type"];

/** Facility fields people who lost something may see in search results (docs/04-architecture.md §9-2). */
export type PublicFacility = { slug: string; name: string; region: string; type: FacilityType };

export const FACILITY_TYPES = ["ski_resort", "hotel", "school", "festival", "cafe", "other"] as const satisfies readonly FacilityType[];

/** Chip order on P-01 (docs/03-screens.md P-01). "other" has no chip. */
export const FACILITY_TYPE_CHIPS = ["ski_resort", "hotel", "school", "festival", "cafe"] as const satisfies readonly FacilityType[];

// Figma draws no icon for "other"; it reuses the generic package icon.
export const FACILITY_TYPE_ICON: Record<FacilityType, IconName> = {
  ski_resort: "facility-ski",
  hotel: "facility-hotel",
  school: "facility-school",
  festival: "facility-festival",
  cafe: "facility-cafe",
  other: "package",
};

const MAX_QUERY_LENGTH = 50;

const SearchParamsSchema = z.object({
  q: z.string().trim().max(MAX_QUERY_LENGTH).catch(""),
  type: z.enum(FACILITY_TYPES).nullable().catch(null),
});

export type FacilitySearch = z.infer<typeof SearchParamsSchema>;

/** Reads ?q= and ?type= leniently: bad values fall back to "no filter" instead of an error page. */
export function parseFacilitySearch(params: Record<string, string | string[] | undefined>): FacilitySearch {
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  return SearchParamsSchema.parse({ q: first(params.q) ?? "", type: first(params.type) ?? null });
}

export function hasSearch(search: FacilitySearch): boolean {
  return search.q !== "" || search.type !== null;
}

/** Copies only the allowlisted fields, whatever the row contains. */
export function toPublicFacility(row: { slug: string; name: string; region: string | null; type: FacilityType }): PublicFacility {
  return { slug: row.slug, name: row.name, region: row.region ?? "", type: row.type };
}

/** Groups facilities by the first word of the region ("강원 평창군" → "강원"), in first-seen order. */
export function groupByProvince(facilities: readonly PublicFacility[]): { province: string; facilities: PublicFacility[] }[] {
  const groups = new Map<string, PublicFacility[]>();
  for (const f of facilities) {
    const province = f.region.split(/\s+/)[0] || "";
    groups.set(province, [...(groups.get(province) ?? []), f]);
  }
  return [...groups].map(([province, list]) => ({ province, facilities: list }));
}

export function facilitySearchHref(search: Partial<FacilitySearch>): string {
  const params = new URLSearchParams();
  if (search.q) params.set("q", search.q);
  if (search.type) params.set("type", search.type);
  const qs = params.toString();
  return qs ? `/?${qs}` : "/";
}
