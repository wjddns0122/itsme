import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { FacilitySlugSchema, toFacilityPage, type PublicFacilityPage } from "./page-data";

export type FacilityPageData = {
  facility: PublicFacilityPage;
  /** For robots only (noindex when false). Never rendered. */
  listed: boolean;
};

/** Cache tag for one facility page; the settings screen (A-08) revalidates it after edits. */
export const facilityPageTag = (slug: string) => `facility:${slug}`;

/**
 * Facility page data by slug, with the service role (the visitor is not signed in), limited to
 * the §9-2 fields. Unlisted facilities still open by direct link (QR, homepage); they are only
 * kept out of search. Returns null for unknown slugs. Throws on database errors so they are not cached.
 */
export async function getFacilityPage(slug: string): Promise<FacilityPageData | null> {
  "use cache";
  cacheLife("minutes");
  cacheTag(facilityPageTag(slug));

  if (!FacilitySlugSchema.safeParse(slug).success) return null;

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("facilities")
    // §9-2 columns plus is_listed (robots only). Never add address or ids.
    .select("slug, name, region, type, intro, homepage_url, contact_phone, hours, desk_location, pickup_guide, areas, is_listed")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error(`facility page lookup failed: ${error.code}`);
  if (!data) return null;

  const { is_listed, ...row } = data;
  return { facility: toFacilityPage(row), listed: is_listed };
}
