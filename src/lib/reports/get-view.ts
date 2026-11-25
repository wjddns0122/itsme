import "server-only";
import { cache } from "react";
import { signPhotoUrls } from "@/lib/storage";
import { BUCKETS } from "@/lib/storage-paths";
import { createAdminClient } from "@/lib/supabase/admin";
import { ReportTokenSchema, VISIBLE_CANDIDATE_STATUSES, candidatePhotoPaths, toReportView, type ReportView } from "./view";

export type ReportViewResult = { status: "ok"; view: ReportView } | { status: "not_found" } | { status: "error" };

/**
 * getReportView (docs/04-architecture.md §6-2). Cached per request so the top bar and the page share one lookup.: the token is the only key, so it runs with the
 * service role and every query is scoped to the report it finds. Columns are the §9-2 allowlist;
 * score and coverage are read only to make labels in toReportView and never leave it.
 */
export const getReportView = cache(async (token: string): Promise<ReportViewResult> => {
  if (!ReportTokenSchema.safeParse(token).success) return { status: "not_found" };
  const supabase = createAdminClient();

  const { data: report, error } = await supabase
    .from("lost_reports")
    .select(
      "id, facility_id, description, user_category, lost_from, lost_to, lost_area, lost_time_of_day, is_rental, status, created_at, ai_status, facility:facilities(name, slug, desk_location, hours, contact_phone, pickup_guide)",
    )
    .eq("access_token", token)
    .maybeSingle();
  if (error) return failed("report", error.code);
  if (!report || !report.facility) return { status: "not_found" };

  const { data: candidates, error: candidateError } = await supabase
    .from("match_candidates")
    .select(
      "id, status, score, coverage, pickup_message, proof_request, item:found_items(category, subcategory, public_summary, found_at, found_area, is_sensitive, photo_paths, facility_id, ai_status, review_needed)",
    )
    .eq("lost_report_id", report.id)
    .in("status", [...VISIBLE_CANDIDATE_STATUSES]);
  if (candidateError) return failed("candidates", candidateError.code);

  // ADR-030: one 10-minute signed URL per shown candidate that passes isPhotoPublic, only for
  // items and paths of this report's facility (the service role would sign anything).
  // Signing failures leave the map empty and the card falls back to the category icon.
  const photoUrls = await signPhotoUrls(supabase, BUCKETS.foundItems, candidatePhotoPaths(candidates, report.facility_id));

  // toReportView copies only the allowlisted fields out of these rows.
  return { status: "ok", view: toReportView(report, report.facility, candidates, photoUrls) };
});

function failed(step: string, code: string): ReportViewResult {
  console.error(JSON.stringify({ event: "report_view_failed", step, code }));
  return { status: "error" };
}
