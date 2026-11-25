"use server";

import { refresh, updateTag } from "next/cache";
import { getAdminContext } from "@/lib/auth/admin";
import { facilityPageTag } from "@/lib/facilities/get-facility";
import { createClient } from "@/lib/supabase/server";
import { FacilitySettingsSchema, type FacilitySettingsInput } from "@/lib/validation/facility";
import type { ActionResult } from "./result";

/**
 * A-08 [저장] (FL-070). RLS lets only the facility's owner update it; a staff member's update touches
 * no row and comes back as `unauthorized`. The cached public page (/f/{slug}) is refreshed at once.
 */
export async function updateFacility(input: FacilitySettingsInput): Promise<ActionResult<null>> {
  const parsed = FacilitySettingsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_input" };
  const f = parsed.data;
  const { facility } = await getAdminContext();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("facilities")
    .update({
      name: f.name,
      type: f.type,
      region: f.region,
      address: f.address,
      contact_phone: f.contactPhone,
      homepage_url: f.homepageUrl,
      intro: f.intro,
      hours: f.hours,
      desk_location: f.deskLocation,
      pickup_guide: f.pickupGuide,
      transfer_days: f.transferDays,
      areas: f.areas,
      is_listed: f.isListed,
    })
    .eq("id", facility.id)
    .select("slug");
  if (error) {
    console.error(JSON.stringify({ event: "update_facility_failed", code: error.code }));
    return { ok: false, error: "internal" };
  }
  if (data.length === 0) return { ok: false, error: "unauthorized" };
  updateTag(facilityPageTag(data[0].slug));
  refresh();
  return { ok: true, data: null };
}
