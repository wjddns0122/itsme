import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { ADMIN_LOGIN, LOGIN_ERROR_NO_FACILITY } from "@/lib/admin/routes";
import { createClient } from "@/lib/supabase/server";

type Facility = { id: string; name: string; slug: string };

export function firstFacilityByName(facilities: readonly (Facility | null)[]): Facility | null {
  const present = facilities.filter((f): f is Facility => f !== null);
  return present.sort((a, b) => a.name.localeCompare(b.name, "ko"))[0] ?? null;
}

export type AdminContext = {
  userId: string;
  facility: Facility;
};

/**
 * The signed-in admin and their facility. Redirects to the login page when there is
 * no session or no facility. Cached per request, so the layout and pages share one lookup.
 * Reads cookies: call it inside a <Suspense> boundary.
 */
export const getAdminContext = cache(async (): Promise<AdminContext> => {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims?.sub;
  if (!userId) redirect(ADMIN_LOGIN);

  // MVP: one facility per admin. With several, the first by name is used.
  const { data, error } = await supabase
    .from("facility_members")
    .select("facility:facilities(id, name, slug)")
    .eq("user_id", userId);
  if (error) throw new Error(`facility lookup failed: ${error.code}`);

  const facility = firstFacilityByName(data.map((row) => row.facility));
  if (!facility) redirect(`${ADMIN_LOGIN}?error=${LOGIN_ERROR_NO_FACILITY}`);

  return { userId, facility };
});
