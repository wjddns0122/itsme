import "server-only";
import { cache } from "react";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { claimQuestionsFor, isHighValueCategory, type ClaimQuestionKey } from "@/lib/validation/claim";
import { categoryLabel } from "@/lib/validation/constants";
import { foundDay, ReportTokenSchema } from "./view";

// P-05 소유권 확인 요청. Looked up by the report's access token with the service role, and built
// only from the allowlist (docs/04-architecture.md §9-2): no private features, photos or scores.

export type ClaimBlock = "active_exists" | "limit" | "not_available";

export type ClaimView = {
  facilityName: string;
  item: { category: string; summary: string | null; foundDate: string | null; foundArea: string | null; categoryCode: string };
  questions: ClaimQuestionKey[];
  highValue: boolean;
  /** Why a request cannot be made now; mirrors submit_claim so the page explains before typing. */
  blocked: ClaimBlock | null;
};

export type ClaimViewResult = { status: "ok"; view: ClaimView } | { status: "not_found" } | { status: "error" };

export const getClaimView = cache(async (token: string, candidateId: string): Promise<ClaimViewResult> => {
  if (!ReportTokenSchema.safeParse(token).success || !z.uuid().safeParse(candidateId).success) return { status: "not_found" };
  const supabase = createAdminClient();
  const { data: report, error } = await supabase.from("lost_reports").select("id, status, facility:facilities(name)").eq("access_token", token).maybeSingle();
  if (error) return { status: "error" };
  if (!report || !report.facility) return { status: "not_found" };

  const [candidate, active] = await Promise.all([
    supabase
      .from("match_candidates")
      .select("status, claim_attempt, item:found_items(category, public_summary, found_at, found_area, is_sensitive, status)")
      .eq("id", candidateId)
      .eq("lost_report_id", report.id)
      .maybeSingle(),
    supabase.from("match_candidates").select("id", { count: "exact", head: true }).eq("lost_report_id", report.id).in("status", ["claimed", "needs_proof"]),
  ]);
  if (candidate.error || active.error) return { status: "error" };
  const c = candidate.data;
  if (!c || !c.item) return { status: "not_found" };

  const sensitive = c.item.is_sensitive;
  return {
    status: "ok",
    view: {
      facilityName: report.facility.name,
      item: {
        category: categoryLabel(c.item.category),
        categoryCode: c.item.category,
        summary: sensitive ? null : c.item.public_summary,
        foundDate: sensitive ? null : foundDay(c.item.found_at),
        foundArea: sensitive ? null : c.item.found_area,
      },
      questions: claimQuestionsFor(c.item.category),
      highValue: isHighValueCategory(c.item.category),
      blocked: blockOf(report.status, c.status, c.claim_attempt, c.item.status, active.count ?? 0),
    },
  };
});

function blockOf(reportStatus: string, candidateStatus: string, attempts: number, itemStatus: string, activeClaims: number): ClaimBlock | null {
  if (!["open", "claimed"].includes(reportStatus) || ["approved", "dismissed"].includes(candidateStatus)) return "not_available";
  if (activeClaims > 0) return "active_exists";
  if (candidateStatus !== "suggested" || attempts >= 2) return "limit";
  if (!["stored", "claimed"].includes(itemStatus)) return "not_available";
  return null;
}
