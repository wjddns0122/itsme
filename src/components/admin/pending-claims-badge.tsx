import { getAdminContext } from "@/lib/auth/admin";
import { createClient } from "@/lib/supabase/server";
import ko from "../../../messages/ko.json";

/** "확인 요청 n" count next to the menu item. Hidden at 0 or when the count cannot be read. */
export async function PendingClaimsBadge() {
  const { facility } = await getAdminContext();
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("match_candidates")
    .select("id", { count: "exact", head: true })
    .eq("facility_id", facility.id)
    .eq("status", "claimed");
  if (error || !count) return null;

  return (
    <span
      aria-label={`${ko.admin.nav.pendingClaims} ${count}`}
      className="rounded-ui-pill bg-brand px-[7px] py-px text-caption font-bold text-on-brand"
    >
      {count}
    </span>
  );
}
