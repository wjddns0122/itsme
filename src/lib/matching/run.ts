import "server-only";
import { getAi } from "@/lib/ai/client";
import { judgeSimilarity, type JudgeCandidate, type Judgement } from "@/lib/ai/judge";
import { SIMILARITY_JUDGE_PROMPT } from "@/lib/ai/prompts";
import { seoulClock, seoulDate } from "@/lib/dates";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/types";
import { DEFAULT_MATCH_CONFIG, TIME_OF_DAY_START_HOUR, type MatchConfig, type TimeOfDay } from "./config";
import { planCandidates, type CandidatePlan, type ExistingCandidate, type ScoredPair } from "./plan";
import { scoreCandidate } from "./score";

// Matching runs (docs/05-ai-matching.md §5-4, §6): prefilter RPC → AI similarity judging →
// rule scores → planCandidates → write. Runs in after() with the service role, so every query
// stays inside the facility of the report or item it started from (the RPCs join on facility_id).

type Admin = ReturnType<typeof createAdminClient>;
export type Judge = (base: string, candidates: readonly JudgeCandidate[]) => Promise<Map<string, Judgement>>;
export type MatchDeps = { supabase: Admin; judge: Judge; config: MatchConfig };
export type MatchRunResult = { status: "ok"; plan: CandidatePlan; created: number } | { status: "skipped" } | { status: "error"; step: string };

const ACTIVE_REPORT: ("open" | "claimed")[] = ["open", "claimed"];
const ACTIVE_ITEM: ("stored" | "claimed")[] = ["stored", "claimed"];
const CANDIDATE_COLUMNS = "id, lost_report_id, found_item_id, status, score, coverage, notified_at, breakdown";

export function defaultMatchDeps(): MatchDeps {
  return { supabase: createAdminClient(), judge: geminiJudge, config: DEFAULT_MATCH_CONFIG };
}

/** Without AI settings every candidate gets the neutral value: rule scores only, no notifications. */
const geminiJudge: Judge = async (base, candidates) => {
  let ai: ReturnType<typeof getAi>;
  try {
    ai = getAi();
  } catch {
    console.error(JSON.stringify({ event: "ai_not_configured", kind: "judge" }));
    return new Map();
  }
  return judgeSimilarity({ client: ai.client, model: ai.env.LLM_MODEL, base, candidates });
};

/** Lost report → found items of the same facility. */
export async function matchForReport(reportId: string, deps: MatchDeps = defaultMatchDeps()): Promise<MatchRunResult> {
  const { supabase, config } = deps;
  const { data: report, error } = await supabase
    .from("lost_reports")
    .select("id, facility_id, status, category, colors, brand, ai_confidence, search_text, description, secret_detail, lost_from, lost_to, lost_area, lost_time_of_day")
    .eq("id", reportId)
    .maybeSingle();
  if (error) return failed("report", error.code);
  if (!report || !(ACTIVE_REPORT as string[]).includes(report.status)) return { status: "skipped" };

  const { data: items, error: rpcError } = await supabase.rpc("candidate_items_for_report", { p_report_id: reportId, p_limit: config.judgeMaxCandidates });
  if (rpcError) return failed("prefilter", rpcError.code);
  const existing = await loadCandidates(supabase, report.facility_id, "lost_report_id", [reportId]);
  if (!existing.ok) return failed("existing", existing.code);

  const base = [report.search_text, `원문: ${report.description}`, report.secret_detail ? `추가 특징: ${report.secret_detail}` : null].filter(Boolean).join("\n");
  const judgements = items.length > 0 ? await deps.judge(base, items.map((i) => ({ id: i.found_item_id, text: i.search_text ?? "" }))) : new Map<string, Judgement>();

  const scored = items.map((i) =>
    scorePair(
      config,
      { id: report.id, category: report.category, colors: report.colors, brand: report.brand, confidence: report.ai_confidence, lostFrom: report.lost_from, lostTo: report.lost_to, area: report.lost_area, timeOfDay: report.lost_time_of_day },
      { id: i.found_item_id, category: i.category, colors: i.colors ?? [], brand: i.brand ?? null, confidence: i.ai_confidence ?? null, foundAt: i.found_at, area: i.found_area ?? null },
      judgements.get(i.found_item_id),
    ),
  );
  const seen = new Set(items.map((i) => i.found_item_id));
  scored.push(...staleSuggested(existing.rows, (c) => !seen.has(c.itemId)));

  return applyPlan(supabase, report.facility_id, planCandidates(scored, existing.rows, config));
}

/** Found item → open lost reports of the same facility (reverse direction, also after an edit). */
export async function matchForItem(itemId: string, deps: MatchDeps = defaultMatchDeps()): Promise<MatchRunResult> {
  const { supabase, config } = deps;
  const { data: item, error } = await supabase
    .from("found_items")
    .select("id, facility_id, status, category, colors, brand, ai_confidence, search_text, found_at, found_area")
    .eq("id", itemId)
    .maybeSingle();
  if (error) return failed("item", error.code);
  if (!item || !(ACTIVE_ITEM as string[]).includes(item.status) || !item.search_text) return { status: "skipped" };

  const { data: reports, error: rpcError } = await supabase.rpc("candidate_reports_for_item", { p_item_id: itemId, p_limit: config.judgeMaxCandidates });
  if (rpcError) return failed("prefilter", rpcError.code);
  const ofItem = await loadCandidates(supabase, item.facility_id, "found_item_id", [itemId]);
  if (!ofItem.ok) return failed("existing", ofItem.code);
  const reportIds = [...new Set([...reports.map((r) => r.lost_report_id), ...ofItem.rows.map((c) => c.reportId)])];
  const existing = reportIds.length > 0 ? await loadCandidates(supabase, item.facility_id, "lost_report_id", reportIds) : ({ ok: true, rows: [] } as const);
  if (!existing.ok) return failed("existing", existing.code);

  const judgements = reports.length > 0 ? await deps.judge(item.search_text, reports.map((r) => ({ id: r.lost_report_id, text: r.search_text ?? "" }))) : new Map<string, Judgement>();

  const scored = reports.map((r) =>
    scorePair(
      config,
      { id: r.lost_report_id, category: r.category ?? null, colors: r.colors ?? [], brand: r.brand ?? null, confidence: r.ai_confidence ?? null, lostFrom: r.lost_from, lostTo: r.lost_to, area: r.lost_area ?? null, timeOfDay: r.lost_time_of_day ?? null },
      { id: item.id, category: item.category, colors: item.colors, brand: item.brand, confidence: item.ai_confidence, foundAt: item.found_at, area: item.found_area },
      judgements.get(r.lost_report_id),
    ),
  );
  const seen = new Set(reports.map((r) => r.lost_report_id));
  scored.push(...staleSuggested(ofItem.rows, (c) => !seen.has(c.reportId)));

  return applyPlan(supabase, item.facility_id, planCandidates(scored, existing.rows, config));
}

type ReportSide = { id: string; category: string | null; colors: string[]; brand: string | null; confidence: number | null; lostFrom: string; lostTo: string; area: string | null; timeOfDay: string | null };
type ItemSide = { id: string; category: string | null; colors: string[]; brand: string | null; confidence: number | null; foundAt: string; area: string | null };

function scorePair(config: MatchConfig, report: ReportSide, item: ItemSide, judgement: Judgement | undefined): ScoredPair {
  const j = judgement ?? { similarity: config.neutralSimilarity, matched: [], conflicts: [], judged: false };
  const result = scoreCandidate(
    {
      aiSimilarity: j.similarity,
      a: { category: report.category, colors: report.colors, brand: report.brand, confidence: report.confidence },
      b: { category: item.category, colors: item.colors, brand: item.brand, confidence: item.confidence },
      area: { report: report.area, item: item.area },
      date: { lostFrom: report.lostFrom, lostTo: report.lostTo, found: seoulDate(item.foundAt), foundTime: seoulClock(item.foundAt), lostTimeOfDay: asTimeOfDay(report.timeOfDay) },
    },
    config,
  );
  if (result.excluded) return { reportId: report.id, itemId: item.id, score: null, coverage: 0, judged: j.judged, breakdown: { excluded: result.reason } };
  return {
    reportId: report.id,
    itemId: item.id,
    score: result.score,
    coverage: result.coverage,
    judged: j.judged,
    // Admin only (A-05, A-06): why the two look alike. Never sent to the person who lost something.
    breakdown: { ...result.breakdown, matched: j.matched, conflicts: j.conflicts, prompt: SIMILARITY_JUDGE_PROMPT.version },
  };
}

/** Suggested rows this run no longer finds (item edited, report dates changed …) count as excluded. */
function staleSuggested(rows: readonly ExistingCandidate[], stale: (c: ExistingCandidate) => boolean): ScoredPair[] {
  return rows
    .filter((c) => c.status === "suggested" && stale(c))
    .map((c) => ({ reportId: c.reportId, itemId: c.itemId, score: null, coverage: 0, judged: true, breakdown: {} }));
}

function asTimeOfDay(value: string | null): TimeOfDay | null {
  return value !== null && value in TIME_OF_DAY_START_HOUR ? (value as TimeOfDay) : null;
}

async function loadCandidates(
  supabase: Admin,
  facilityId: string,
  column: "lost_report_id" | "found_item_id",
  ids: readonly string[],
): Promise<{ ok: true; rows: ExistingCandidate[] } | { ok: false; code: string }> {
  const { data, error } = await supabase.from("match_candidates").select(CANDIDATE_COLUMNS).eq("facility_id", facilityId).in(column, ids);
  if (error) return { ok: false, code: error.code };
  return {
    ok: true,
    rows: data.map((c) => ({
      id: c.id,
      reportId: c.lost_report_id,
      itemId: c.found_item_id,
      status: c.status,
      score: Number(c.score),
      coverage: Number(c.coverage),
      notifiedAt: c.notified_at,
      breakdown: isObject(c.breakdown) ? c.breakdown : {},
    })),
  };
}

/**
 * Writes the plan. Updates and deletes are guarded with `status = 'suggested'` and inserts ignore
 * existing pairs, so a candidate claimed or dismissed meanwhile is never overwritten.
 */
async function applyPlan(supabase: Admin, facilityId: string, plan: CandidatePlan): Promise<MatchRunResult> {
  if (plan.deletes.length > 0) {
    const { error } = await supabase.from("match_candidates").delete().eq("facility_id", facilityId).in("id", plan.deletes).eq("status", "suggested");
    if (error) return failed("delete", error.code);
  }

  const inserts = plan.writes.filter((w) => w.existingId === null);
  let created: { id: string; lost_report_id: string; found_item_id: string }[] = [];
  if (inserts.length > 0) {
    const { data, error } = await supabase
      .from("match_candidates")
      .upsert(
        inserts.map((w) => ({ facility_id: facilityId, lost_report_id: w.reportId, found_item_id: w.itemId, score: w.score, coverage: w.coverage, breakdown: w.breakdown as Json })),
        { onConflict: "lost_report_id,found_item_id", ignoreDuplicates: true },
      )
      .select("id, lost_report_id, found_item_id");
    if (error) return failed("insert", error.code);
    created = await dropClosedPairs(supabase, facilityId, data);
  }

  const updates = await Promise.all(
    plan.writes
      .filter((w) => w.existingId !== null)
      .map((w) =>
        supabase
          .from("match_candidates")
          .update({ score: w.score, coverage: w.coverage, breakdown: w.breakdown as Json })
          .eq("facility_id", facilityId)
          .eq("id", w.existingId as string)
          .eq("status", "suggested"),
      ),
  );
  const updateError = updates.find((u) => u.error)?.error;
  if (updateError) return failed("update", updateError.code);

  if (created.length > 0) {
    const { error } = await supabase
      .from("item_events")
      .insert(created.map((c) => ({ facility_id: facilityId, found_item_id: c.found_item_id, lost_report_id: c.lost_report_id, type: "matched", payload: {} })));
    if (error) console.error(JSON.stringify({ event: "match_event_failed", code: error.code }));
  }
  return { status: "ok", plan, created: created.length };
}

/**
 * A report may be cancelled or an item returned while this run was judging. New pairs whose report
 * or item is no longer active are removed again right after the insert.
 */
async function dropClosedPairs<T extends { id: string; lost_report_id: string; found_item_id: string }>(supabase: Admin, facilityId: string, created: T[]): Promise<T[]> {
  if (created.length === 0) return created;
  const [reports, items] = await Promise.all([
    supabase.from("lost_reports").select("id").in("id", [...new Set(created.map((c) => c.lost_report_id))]).in("status", ACTIVE_REPORT),
    supabase.from("found_items").select("id").in("id", [...new Set(created.map((c) => c.found_item_id))]).in("status", ACTIVE_ITEM),
  ]);
  if (reports.error || items.error) return created;
  const openReports = new Set(reports.data.map((r) => r.id));
  const openItems = new Set(items.data.map((i) => i.id));
  const closed = created.filter((c) => !openReports.has(c.lost_report_id) || !openItems.has(c.found_item_id));
  if (closed.length === 0) return created;
  const { error } = await supabase.from("match_candidates").delete().eq("facility_id", facilityId).in("id", closed.map((c) => c.id)).eq("status", "suggested");
  if (error) console.error(JSON.stringify({ event: "match_cleanup_failed", code: error.code }));
  return created.filter((c) => !closed.includes(c));
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function failed(step: string, code: string): MatchRunResult {
  console.error(JSON.stringify({ event: "match_failed", step, code }));
  return { status: "error", step };
}
