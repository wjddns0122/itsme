import "server-only";
import { getAi } from "@/lib/ai/client";
import { normalizeReport } from "@/lib/ai/normalize";
import { notifyNewCandidates } from "@/lib/notify/notify";
import type { Json } from "@/lib/supabase/types";
import { reportMatchFields } from "./report-fields";
import { defaultMatchDeps, matchForItem, matchForReport, type MatchDeps } from "./run";

// Background steps after a save (docs/04-architecture.md §7). Every step logs and moves on:
// a failed normalization still matches with the raw text, a failed match leaves the saved record as is.

/** 분실 신고 저장 뒤: 정규화 → 매칭. `ai_status` stays `pending` until matching is done so P-04 keeps "찾는 중". */
export async function processReport(reportId: string, deps: MatchDeps = defaultMatchDeps()): Promise<void> {
  const { supabase } = deps;
  const { data: report, error } = await supabase
    .from("lost_reports")
    .select("id, description, secret_detail, user_category, colors, brand, ai_status")
    .eq("id", reportId)
    .maybeSingle();
  if (error || !report) {
    console.error(JSON.stringify({ event: "process_report_failed", step: "load", code: error?.code ?? "not_found" }));
    return;
  }

  let finalStatus = report.ai_status;
  try {
    if (report.ai_status === "pending" || report.ai_status === "failed") {
      const normalized = await normalize(report);
      const { ai_status, ...fields } = reportMatchFields(report, normalized?.ok ? normalized.normalization : null);
      finalStatus = ai_status;
      const aiRaw = normalized?.ok ? ({ ...normalized.raw, model: normalized.model, latency_ms: normalized.latencyMs } as Json) : null;
      const { error: updateError } = await supabase.from("lost_reports").update({ ...fields, ai_raw: aiRaw }).eq("id", report.id);
      if (updateError) console.error(JSON.stringify({ event: "process_report_failed", step: "save_normalization", code: updateError.code }));
    }
    const result = await matchForReport(report.id, deps);
    console.info(JSON.stringify({ event: "match_report_done", status: result.status, created: result.status === "ok" ? result.created : 0 }));
    if (result.status === "ok" && result.plan.notify.length > 0) await notifyNewCandidates(result.plan.notify);
  } finally {
    if (finalStatus !== report.ai_status) {
      const { error: statusError } = await supabase.from("lost_reports").update({ ai_status: finalStatus }).eq("id", report.id);
      if (statusError) console.error(JSON.stringify({ event: "process_report_failed", step: "status", code: statusError.code }));
    }
  }
}

/** 습득물 저장·수정 뒤: 역방향 매칭. */
export async function processItem(itemId: string, deps: MatchDeps = defaultMatchDeps()): Promise<void> {
  const result = await matchForItem(itemId, deps);
  console.info(JSON.stringify({ event: "match_item_done", status: result.status, created: result.status === "ok" ? result.created : 0 }));
  if (result.status === "ok" && result.plan.notify.length > 0) await notifyNewCandidates(result.plan.notify);
}

async function normalize(report: { description: string; secret_detail: string | null; user_category: string | null }) {
  let ai: ReturnType<typeof getAi>;
  try {
    ai = getAi();
  } catch {
    console.error(JSON.stringify({ event: "ai_not_configured", kind: "normalize" }));
    return null;
  }
  return normalizeReport({
    client: ai.client,
    model: ai.env.LLM_MODEL,
    input: { description: report.description, secretDetail: report.secret_detail, userCategory: report.user_category },
  });
}
