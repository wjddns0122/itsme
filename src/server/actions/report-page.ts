"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { ReportTokenSchema } from "@/lib/reports/view";
import { createAdminClient } from "@/lib/supabase/admin";
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

function failed(step: string, code: string): ActionResult<null> {
  console.error(JSON.stringify({ event: "report_page_action_failed", step, code }));
  return { ok: false, error: "internal" };
}
