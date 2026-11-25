import "server-only";
import { cacheLife } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { toPublicFacility, type FacilitySearch, type PublicFacility } from "./public";

export type FacilitySearchResult = { ok: true; data: PublicFacility[] } | { ok: false };

const SEARCH_LIMIT = 20;
const OVERVIEW_LIMIT = 30;

/**
 * P-01 search. Runs with the service role because people searching are not signed in; the
 * search_facilities RPC only returns listed facilities and only slug, name, region, type.
 */
export async function searchFacilities(search: FacilitySearch): Promise<FacilitySearchResult> {
  return runSearch(search.q, search.type, SEARCH_LIMIT);
}

/** Listed facilities for "지역별 참여 시설" before any search. Same for everyone, so cached. */
export async function listedFacilities(): Promise<FacilitySearchResult> {
  "use cache";
  cacheLife("minutes");
  return runSearch("", null, OVERVIEW_LIMIT);
}

async function runSearch(q: string, type: FacilitySearch["type"], limit: number): Promise<FacilitySearchResult> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("search_facilities", {
    p_query: q,
    p_type: type ?? undefined,
    p_limit: limit,
  });
  if (error) {
    // Search words can be personal (a place name is fine, but people type anything): log the code only.
    console.error(JSON.stringify({ event: "facility_search_failed", code: error.code }));
    return { ok: false };
  }
  return { ok: true, data: data.map(toPublicFacility) };
}
