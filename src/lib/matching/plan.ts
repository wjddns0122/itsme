// Candidate save rules (docs/05-ai-matching.md §6). Pure: decides what to write, run.ts writes it.
// - only `suggested` rows change; claimed, approved, dismissed … are never touched or recreated
// - at most `maxSuggestedPerReport` suggested rows per report, best scores first
// - running twice with the same scores leaves the same rows

import type { Database } from "@/lib/supabase/types";
import { DEFAULT_MATCH_CONFIG, type MatchConfig } from "./config";
import { findTies, shouldNotify } from "./score";

type CandidateStatus = Database["public"]["Enums"]["candidate_status"];
export type Breakdown = Record<string, unknown>;

/** One report–item pair scored in this run. `score: null` = excluded by the rules. */
export type ScoredPair = {
  reportId: string;
  itemId: string;
  score: number | null;
  coverage: number;
  judged: boolean;
  breakdown: Breakdown;
};

export type ExistingCandidate = {
  id: string;
  reportId: string;
  itemId: string;
  status: CandidateStatus;
  score: number;
  coverage: number;
  notifiedAt: string | null;
  breakdown: Breakdown;
};

/** `existingId: null` = insert (ignored if the pair appeared meanwhile), otherwise update while still suggested. */
export type CandidateWrite = {
  existingId: string | null;
  reportId: string;
  itemId: string;
  score: number;
  coverage: number;
  breakdown: Breakdown;
};

export type CandidatePlan = {
  writes: CandidateWrite[];
  /** Suggested rows that fell below the threshold or out of the top list. */
  deletes: string[];
  /** New strong candidates for the email (FL-050): not notified yet, judged, enough coverage. */
  notify: { reportId: string; itemId: string }[];
};

type PoolEntry = Omit<CandidateWrite, "breakdown"> & { breakdown: Breakdown; judged: boolean; notifiedAt: string | null; touched: boolean };

const round = (n: number, digits: number) => Number(n.toFixed(digits));

export function planCandidates(
  scored: readonly ScoredPair[],
  existing: readonly ExistingCandidate[],
  config: MatchConfig = DEFAULT_MATCH_CONFIG,
): CandidatePlan {
  const plan: CandidatePlan = { writes: [], deletes: [], notify: [] };
  const reportIds = [...new Set(scored.map((s) => s.reportId))].sort();
  for (const reportId of reportIds) {
    planReport(
      scored.filter((s) => s.reportId === reportId),
      existing.filter((e) => e.reportId === reportId),
      config,
      plan,
    );
  }
  return plan;
}

function planReport(scored: readonly ScoredPair[], existing: readonly ExistingCandidate[], config: MatchConfig, plan: CandidatePlan) {
  const byItem = new Map(existing.map((e) => [e.itemId, e]));
  const pool = new Map<string, PoolEntry>();
  for (const e of existing) {
    if (e.status !== "suggested") continue;
    pool.set(e.itemId, { ...e, existingId: e.id, judged: e.breakdown.judged !== false, touched: false });
  }

  for (const pair of scored) {
    const current = byItem.get(pair.itemId);
    if (current && current.status !== "suggested") continue;
    const score = pair.score === null ? null : round(pair.score, 4);
    if (score === null || score < config.saveThreshold) {
      pool.delete(pair.itemId);
      continue;
    }
    pool.set(pair.itemId, {
      existingId: current?.id ?? null,
      reportId: pair.reportId,
      itemId: pair.itemId,
      score,
      coverage: round(pair.coverage, 3),
      breakdown: { ...pair.breakdown, judged: pair.judged },
      judged: pair.judged,
      notifiedAt: current?.notifiedAt ?? null,
      touched: true,
    });
  }

  const ranked = [...pool.values()].sort((a, b) => b.score - a.score || a.itemId.localeCompare(b.itemId));
  const kept = ranked.slice(0, config.maxSuggestedPerReport);
  const ties = findTies(kept.map((k) => k.score), config.tieGap);

  kept.forEach((entry, i) => {
    const breakdown = { ...entry.breakdown, tie: ties[i] };
    if (entry.touched || entry.breakdown.tie !== ties[i]) {
      plan.writes.push({ existingId: entry.existingId, reportId: entry.reportId, itemId: entry.itemId, score: entry.score, coverage: entry.coverage, breakdown });
    }
    if (entry.judged && entry.notifiedAt === null && shouldNotify(entry.score, entry.coverage, config)) {
      plan.notify.push({ reportId: entry.reportId, itemId: entry.itemId });
    }
  });

  const keptItems = new Set(kept.map((k) => k.itemId));
  for (const e of existing) {
    if (e.status === "suggested" && !keptItems.has(e.itemId)) plan.deletes.push(e.id);
  }
}
