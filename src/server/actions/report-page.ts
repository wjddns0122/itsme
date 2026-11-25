"use server";

import { randomUUID } from "node:crypto";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getClaimView, type ClaimBlock } from "@/lib/reports/claim-view";
import { ReportTokenSchema } from "@/lib/reports/view";
import { uploadPhoto } from "@/lib/storage";
import { BUCKETS, claimPhotoPath } from "@/lib/storage-paths";
import { createAdminClient } from "@/lib/supabase/admin";
import { ClaimAnswersSchema, ProofReplySchema } from "@/lib/validation/claim";
import { MAX_PHOTO_BYTES } from "@/lib/validation/item";
import { ReportUpdateSchema, type ReportUpdateInput } from "@/lib/validation/report";
import { after } from "next/server";
import { processReport } from "@/lib/matching/process";
import ko from "../../../messages/ko.json";
import type { ActionResult } from "./result";

// Actions on the report page (P-04, FL-034). The person is not signed in: the access token is the
// key, so each action looks the report up by token and only then touches its rows (service role).

const CandidateIdSchema = z.uuid();

async function reportIdForToken(token: string): Promise<string | null> {
  if (!ReportTokenSchema.safeParse(token).success) return null;
  const { data } = await createAdminClient().from("lost_reports").select("id").eq("access_token", token).maybeSingle();
  return data?.id ?? null;
}

/** [아니에요]: hides one suggested candidate. */
export async function dismissCandidate(token: string, candidateId: string): Promise<ActionResult<null>> {
  if (!CandidateIdSchema.safeParse(candidateId).success) return { ok: false, error: "invalid_input" };
  const reportId = await reportIdForToken(token);
  if (!reportId) return { ok: false, error: "not_found" };

  const { data, error } = await createAdminClient().rpc("dismiss_candidate_by_reporter", {
    p_report_id: reportId,
    p_candidate_id: candidateId,
  });
  if (error) return failed("dismiss", error.code);
  if (!data) return { ok: false, error: "conflict" };
  refresh();
  return { ok: true, data: null };
}

/** [신고 취소]: closes the report and its open candidates in one transaction. */
export async function cancelReport(token: string): Promise<ActionResult<null>> {
  const reportId = await reportIdForToken(token);
  if (!reportId) return { ok: false, error: "not_found" };

  const { data, error } = await createAdminClient().rpc("cancel_lost_report", { p_report_id: reportId });
  if (error) return failed("cancel", error.code);
  if (!data) return { ok: false, error: "conflict" };
  refresh();
  return { ok: true, data: null };
}

export type ClaimState = { ok: false; error: "invalid_input" | "answer_required" | "not_found" | "internal" | ClaimBlock } | null;

/**
 * P-05 [확인 요청하기] (FL-040). The token opens the report; the category of the found item decides
 * which answers are kept. Question texts are stored with the answers so A-06 shows what was asked.
 * Success goes back to P-04. Answers and the photo never reach the person's page again.
 */
export async function submitClaim(token: string, candidateId: string, _prev: ClaimState, formData: FormData): Promise<ClaimState> {
  if (formData.get("website")) return { ok: false, error: "invalid_input" };
  const answers = ClaimAnswersSchema.safeParse(parseJson(formData.get("answers")));
  if (!answers.success) return { ok: false, error: answers.error.issues.some((i) => i.message === "answer_required") ? "answer_required" : "invalid_input" };
  const photo = formData.get("photo");
  const file = photo instanceof File && photo.size > 0 ? photo : null;
  if (file && (!file.type.startsWith("image/") || file.size > MAX_PHOTO_BYTES)) return { ok: false, error: "invalid_input" };

  const view = await getClaimView(token, candidateId);
  if (view.status === "not_found") return { ok: false, error: "not_found" };
  if (view.status === "error") return { ok: false, error: "internal" };
  if (view.view.blocked) return { ok: false, error: view.view.blocked };

  const asked = view.view.questions
    .map((key) => ({ key, question: ko.public.claim.questions[key], answer: answers.data[key] ?? "" }))
    .filter((a) => a.answer.length > 0);
  if (asked.length === 0) return { ok: false, error: "answer_required" };

  const supabase = createAdminClient();
  const { data: report } = await supabase.from("lost_reports").select("id, facility_id").eq("access_token", token).single();
  if (!report) return { ok: false, error: "not_found" };

  let photoPath: string | null = null;
  if (file) {
    const upload = await uploadPhoto(supabase, BUCKETS.claimPhotos, claimPhotoPath(report.facility_id, candidateId, randomUUID()), file);
    if (!upload.ok) return { ok: false, error: "internal" };
    photoPath = upload.path;
  }

  // The SQL argument accepts null (no photo); generated types never mark function arguments nullable.
  const { data: result, error } = await supabase.rpc("submit_claim", { p_report_id: report.id, p_candidate_id: candidateId, p_answers: asked, p_photo_path: photoPath as string });
  if (error || result !== "ok") {
    if (photoPath) await supabase.storage.from(BUCKETS.claimPhotos).remove([photoPath]);
    if (error) {
      console.error(JSON.stringify({ event: "submit_claim_failed", code: error.code }));
      return { ok: false, error: "internal" };
    }
    return { ok: false, error: result === "not_found" ? "not_found" : (result as ClaimBlock) };
  }
  redirect(`/r/${token}`);
}

export type ProofState = { ok: false; error: "reply_required" | "invalid_input" | "not_found" | "not_available" | "internal" } | null;

/** P-04 추가 증빙 (FL-045): answer and optional photo while the admin waits for proof. */
export async function submitProof(token: string, candidateId: string, _prev: ProofState, formData: FormData): Promise<ProofState> {
  if (formData.get("website")) return { ok: false, error: "invalid_input" };
  const reply = ProofReplySchema.safeParse(formData.get("reply"));
  if (!reply.success) return { ok: false, error: "reply_required" };
  if (!CandidateIdSchema.safeParse(candidateId).success || !ReportTokenSchema.safeParse(token).success) return { ok: false, error: "not_found" };
  const photo = formData.get("photo");
  const file = photo instanceof File && photo.size > 0 ? photo : null;
  if (file && (!file.type.startsWith("image/") || file.size > MAX_PHOTO_BYTES)) return { ok: false, error: "invalid_input" };

  const supabase = createAdminClient();
  const { data: report } = await supabase.from("lost_reports").select("id, facility_id").eq("access_token", token).maybeSingle();
  if (!report) return { ok: false, error: "not_found" };
  const { data: candidate } = await supabase.from("match_candidates").select("status").eq("id", candidateId).eq("lost_report_id", report.id).maybeSingle();
  if (!candidate) return { ok: false, error: "not_found" };
  if (candidate.status !== "needs_proof") return { ok: false, error: "not_available" };

  let photoPath: string | null = null;
  if (file) {
    const upload = await uploadPhoto(supabase, BUCKETS.claimPhotos, claimPhotoPath(report.facility_id, candidateId, randomUUID()), file);
    if (!upload.ok) return { ok: false, error: "internal" };
    photoPath = upload.path;
  }
  // Same as submit_claim: the SQL argument accepts null.
  const { data: result, error } = await supabase.rpc("submit_proof", { p_report_id: report.id, p_candidate_id: candidateId, p_reply: reply.data, p_photo_path: photoPath as string });
  if (error || result !== "ok") {
    if (photoPath) await supabase.storage.from(BUCKETS.claimPhotos).remove([photoPath]);
    if (error) console.error(JSON.stringify({ event: "submit_proof_failed", code: error.code }));
    return { ok: false, error: error ? "internal" : "not_available" };
  }
  refresh();
  return null;
}

/**
 * P-04 [신고 내용 보완하기] (FL-023): while the report is still open, the person may add details.
 * The report goes back to "찾는 중", then normalization and matching run again; candidates the
 * person hid stay hidden (plan.ts never recreates dismissed pairs).
 */
export async function updateLostReport(token: string, input: ReportUpdateInput): Promise<ActionResult<null>> {
  const parsed = ReportUpdateSchema.safeParse(input);
  if (!parsed.success || !ReportTokenSchema.safeParse(token).success) return { ok: false, error: "invalid_input" };
  const f = parsed.data;
  const supabase = createAdminClient();
  const { data: report } = await supabase.from("lost_reports").select("id, facility_id, status, user_category").eq("access_token", token).maybeSingle();
  if (!report) return { ok: false, error: "not_found" };
  if (report.status !== "open") return { ok: false, error: "conflict" };
  if (!f.description && !report.user_category) return { ok: false, error: "invalid_input" };

  const { error } = await supabase
    .from("lost_reports")
    .update({ description: f.description, colors: f.colors, brand: f.brand, lost_time_of_day: f.lostTimeOfDay, ai_status: "pending" })
    .eq("id", report.id)
    .eq("status", "open");
  if (error) return failed("update_report", error.code);
  await supabase.from("item_events").insert({ facility_id: report.facility_id, lost_report_id: report.id, type: "report_updated", payload: {} });

  after(() => processReport(report.id));
  redirect(`/r/${token}`);
}

function parseJson(raw: FormDataEntryValue | null): unknown {
  if (typeof raw !== "string") return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function failed(step: string, code: string): ActionResult<null> {
  console.error(JSON.stringify({ event: "report_page_action_failed", step, code }));
  return { ok: false, error: "internal" };
}
