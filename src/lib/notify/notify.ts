import "server-only";
import { formatMonthDay } from "@/lib/dates";
import { foundDay } from "@/lib/reports/view";
import { createAdminClient } from "@/lib/supabase/admin";
import { categoryLabel } from "@/lib/validation/constants";
import { appUrl, sendEmail } from "./send";
import { approvedEmail, newCandidatesEmail, reportReceivedEmail, type PublicItem } from "./templates";

// docs/04-architecture.md §8. Runs in after() with the service role, scoped by the report or
// candidate it was called for. Failures are logged and swallowed.

/** Candidate emails per report in 24 hours (§8). */
export const CANDIDATE_EMAILS_PER_DAY = 3;

export async function notifyReportReceived(reportId: string): Promise<void> {
  const supabase = createAdminClient();
  const { data: r } = await supabase.from("lost_reports").select("contact_email, access_token, facility:facilities(name)").eq("id", reportId).maybeSingle();
  if (!r?.contact_email || !r.facility) return;
  await sendEmail(r.contact_email, reportReceivedEmail({ facilityName: r.facility.name, link: appUrl(`/r/${r.access_token}`) }), "report_received");
}

/** New strong candidates from a matching run (plan.notify). One email per report, at most 3 a day. */
export async function notifyNewCandidates(pairs: readonly { reportId: string; itemId: string }[]): Promise<void> {
  const byReport = new Map<string, string[]>();
  for (const p of pairs) byReport.set(p.reportId, [...(byReport.get(p.reportId) ?? []), p.itemId]);
  for (const [reportId, itemIds] of byReport) {
    try {
      await notifyReport(reportId, itemIds);
    } catch {
      console.error(JSON.stringify({ event: "notify_candidates_failed" }));
    }
  }
}

async function notifyReport(reportId: string, itemIds: string[]) {
  const supabase = createAdminClient();
  const { data: r } = await supabase
    .from("lost_reports")
    .select("id, facility_id, status, contact_email, contact_key, access_token, facility:facilities(name)")
    .eq("id", reportId)
    .maybeSingle();
  if (!r?.contact_email || !r.facility || !["open", "claimed"].includes(r.status)) return;

  const since = new Date(Date.now() - 86_400_000).toISOString();
  const { count } = await supabase.from("item_events").select("id", { count: "exact", head: true }).eq("lost_report_id", reportId).eq("type", "notified").gte("created_at", since);
  if ((count ?? 0) >= CANDIDATE_EMAILS_PER_DAY) return;

  // The same person may have reported twice (same contact_key): one email per found item (§8, F9-1).
  const alreadyTold = new Set<string>();
  if (r.contact_key) {
    const { data } = await supabase
      .from("match_candidates")
      .select("found_item_id, report:lost_reports!inner(contact_key)")
      .eq("report.contact_key", r.contact_key)
      .neq("lost_report_id", reportId)
      .in("found_item_id", itemIds)
      .not("notified_at", "is", null);
    for (const row of data ?? []) alreadyTold.add(row.found_item_id);
  }
  const fresh = itemIds.filter((id) => !alreadyTold.has(id));
  const now = new Date().toISOString();
  if (fresh.length === 0) {
    await supabase.from("match_candidates").update({ notified_at: now }).eq("lost_report_id", reportId).in("found_item_id", itemIds).is("notified_at", null);
    return;
  }

  const { data: items } = await supabase.from("found_items").select("id, category, public_summary, found_at, found_area, is_sensitive").in("id", fresh);
  const publicItems: PublicItem[] = (items ?? []).map((i) => ({
    category: categoryLabel(i.category),
    summary: i.is_sensitive ? null : i.public_summary,
    foundDate: i.is_sensitive ? null : formatMonthDay(foundDay(i.found_at)),
    foundArea: i.is_sensitive ? null : i.found_area,
  }));
  const sent = await sendEmail(r.contact_email, newCandidatesEmail({ facilityName: r.facility.name, link: appUrl(`/r/${r.access_token}`), items: publicItems }), "new_candidates");
  if (!sent) return;

  await supabase.from("match_candidates").update({ notified_at: now }).eq("lost_report_id", reportId).in("found_item_id", itemIds).is("notified_at", null);
  await supabase.from("item_events").insert({ facility_id: r.facility_id, lost_report_id: reportId, type: "notified", payload: { items: fresh.length } });
}

export async function notifyApproved(candidateId: string): Promise<void> {
  const supabase = createAdminClient();
  const { data: c } = await supabase
    .from("match_candidates")
    .select("status, pickup_message, report:lost_reports(contact_email, access_token), facility:facilities(name, desk_location, hours, pickup_guide, contact_phone)")
    .eq("id", candidateId)
    .maybeSingle();
  if (!c || c.status !== "approved" || !c.report?.contact_email || !c.facility) return;
  const f = c.facility;
  await sendEmail(
    c.report.contact_email,
    approvedEmail({
      facilityName: f.name,
      link: appUrl(`/r/${c.report.access_token}`),
      pickup: { desk: f.desk_location, hours: f.hours, bring: f.pickup_guide, contact: f.contact_phone, note: c.pickup_message },
    }),
    "approved",
  );
}
