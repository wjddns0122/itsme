import "server-only";
import { getFacilityPage, type FacilityPageData } from "./get-facility";

export type FacilityLoad = { status: "ok"; data: FacilityPageData } | { status: "not_found" } | { status: "error" };

/** getFacilityPage for pages: turns a database failure into an error state instead of a crash. */
export async function loadFacility(slug: string): Promise<FacilityLoad> {
  try {
    const data = await getFacilityPage(slug);
    return data ? { status: "ok", data } : { status: "not_found" };
  } catch (error) {
    console.error(JSON.stringify({ event: "facility_page_failed", message: error instanceof Error ? error.message : "unknown" }));
    return { status: "error" };
  }
}
