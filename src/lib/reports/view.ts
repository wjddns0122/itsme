import { z } from "zod";
import { DEFAULT_MATCH_CONFIG } from "@/lib/matching/config";
import type { Database } from "@/lib/supabase/types";
import { categoryLabel } from "@/lib/validation/constants";

// P-04 신고 현황: everything a person who lost something may see, built only from the
// allowlist in docs/04-architecture.md §9-2. Never add private_features, photo paths,
// scores, coverage numbers, contact_key, contact details, ai_verdict or review_note here.

type ReportStatus = Database["public"]["Enums"]["report_status"];
type CandidateStatus = Database["public"]["Enums"]["candidate_status"];
type AiStatus = Database["public"]["Enums"]["ai_status"];

export const ReportTokenSchema = z.string().regex(/^[A-Za-z0-9_-]{32}$/);

/** Statuses shown to the person. Rejected and dismissed candidates disappear from their page. */
export const VISIBLE_CANDIDATE_STATUSES = ["suggested", "claimed", "needs_proof", "approved"] as const satisfies readonly CandidateStatus[];

export const MAX_VISIBLE_CANDIDATES = 5;

export type ReportRow = {
  description: string;
  user_category: string | null;
  lost_from: string;
  lost_to: string;
  lost_area: string | null;
  lost_time_of_day: string | null;
  is_rental: boolean;
  status: ReportStatus;
  created_at: string;
  ai_status: AiStatus;
};

export type CandidateRow = {
  id: string;
  status: CandidateStatus;
  score: number;
  coverage: number;
  pickup_message: string | null;
  proof_request: string | null;
  item: {
    category: string;
    subcategory: string | null;
    public_summary: string;
    found_at: string;
    found_area: string | null;
    is_sensitive: boolean;
  } | null;
};

export type FacilityPickupRow = {
  name: string;
  slug: string;
  desk_location: string | null;
  hours: string | null;
  contact_phone: string | null;
  pickup_guide: string | null;
};

export type PublicCandidate = {
  id: string;
  status: Exclude<CandidateStatus, "rejected" | "dismissed">;
  /** A label, never the score (docs/03 §1). */
  similarity: "high" | "medium";
  /** Few known signals: show the "정보가 적어요" line instead of a coverage number. */
  infoLow: boolean;
  item: {
    category: string;
    /** Null for sensitive items: people only see the category (§9-2). */
    summary: string | null;
    foundDate: string | null;
    foundArea: string | null;
  };
  pickupMessage: string | null;
  proofRequest: string | null;
};

export type ReportView = {
  report: {
    description: string;
    userCategory: string | null;
    lostFrom: string;
    lostTo: string;
    lostArea: string | null;
    lostTimeOfDay: string | null;
    isRental: boolean;
    status: ReportStatus;
    createdAt: string;
    aiStatus: AiStatus;
  };
  facility: {
    name: string;
    slug: string;
    deskLocation: string | null;
    hours: string | null;
    contactPhone: string | null;
    pickupGuide: string | null;
  };
  candidates: PublicCandidate[];
};

const isVisible = (s: CandidateStatus): s is PublicCandidate["status"] =>
  (VISIBLE_CANDIDATE_STATUSES as readonly CandidateStatus[]).includes(s);

/** Found date as a Seoul calendar day: "2026-11-25". */
export function foundDay(foundAt: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(foundAt));
}

export function toPublicCandidate(row: CandidateRow): PublicCandidate | null {
  if (!row.item || !isVisible(row.status)) return null;
  const sensitive = row.item.is_sensitive;
  return {
    id: row.id,
    status: row.status,
    similarity: row.score >= DEFAULT_MATCH_CONFIG.notifyThreshold ? "high" : "medium",
    infoLow: row.coverage < DEFAULT_MATCH_CONFIG.coverageMinNotify,
    item: {
      category: categoryLabel(row.item.category),
      summary: sensitive ? null : row.item.public_summary,
      foundDate: sensitive ? null : foundDay(row.item.found_at),
      foundArea: sensitive ? null : row.item.found_area,
    },
    pickupMessage: row.status === "approved" ? row.pickup_message : null,
    proofRequest: row.status === "needs_proof" ? row.proof_request : null,
  };
}

export function toReportView(report: ReportRow, facility: FacilityPickupRow, candidates: readonly CandidateRow[]): ReportView {
  const visible = [...candidates]
    .sort((a, b) => b.score - a.score)
    .map(toPublicCandidate)
    .filter((c): c is PublicCandidate => c !== null)
    .slice(0, MAX_VISIBLE_CANDIDATES);

  return {
    report: {
      description: report.description,
      userCategory: report.user_category,
      lostFrom: report.lost_from,
      lostTo: report.lost_to,
      lostArea: report.lost_area,
      lostTimeOfDay: report.lost_time_of_day,
      isRental: report.is_rental,
      status: report.status,
      createdAt: report.created_at,
      aiStatus: report.ai_status,
    },
    facility: {
      name: facility.name,
      slug: facility.slug,
      deskLocation: facility.desk_location,
      hours: facility.hours,
      contactPhone: facility.contact_phone,
      pickupGuide: facility.pickup_guide,
    },
    candidates: visible,
  };
}

export type ReportPhase = "closed" | "approved" | "needs_proof" | "claimed" | "analyzing" | "empty" | "candidates";

/** Which P-04 state to show. */
export function reportPhase(view: ReportView): ReportPhase {
  if (view.report.status === "closed") return "closed";
  if (view.report.status === "resolved" || view.candidates.some((c) => c.status === "approved")) return "approved";
  if (view.candidates.some((c) => c.status === "needs_proof")) return "needs_proof";
  if (view.candidates.some((c) => c.status === "claimed")) return "claimed";
  if (view.candidates.length > 0) return "candidates";
  return view.report.aiStatus === "pending" ? "analyzing" : "empty";
}

/** Shows the "정보가 적어요" line when every candidate rests on few known signals. */
export function showInfoLow(view: ReportView): boolean {
  return view.candidates.length > 0 && view.candidates.every((c) => c.infoLow);
}
