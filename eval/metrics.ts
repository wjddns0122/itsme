// Matching evaluation metrics (docs/05-ai-matching.md §7-4). Pure, tested in eval/metrics.test.ts.

export type Split = "dev" | "test";

export type ReportOutcome = {
  key: string;
  split: Split;
  /** null for a decoy: the item was never registered. */
  expected: string | null;
  /** Only category, area and date were given (§7-1 #9). */
  blurry: boolean;
  /** Candidates by score, best first. */
  ranked: { item: string; score: number }[];
};

export type MatchSummary = {
  reports: number;
  withAnswer: number;
  top1: number | null;
  top3: number | null;
  mrr: number | null;
  blurry: { n: number; top3: number | null };
  decoys: { n: number; falseAlertRate: number | null };
  wrongTop1Alert: number | null;
};

const ratio = (hit: number, n: number) => (n > 0 ? hit / n : null);

export function rankOf(outcome: ReportOutcome): number | null {
  if (!outcome.expected) return null;
  const i = outcome.ranked.findIndex((c) => c.item === outcome.expected);
  return i < 0 ? null : i + 1;
}

export function summarize(outcomes: readonly ReportOutcome[], notifyThreshold: number): MatchSummary {
  const answered = outcomes.filter((o) => o.expected !== null);
  const ranks = answered.map(rankOf);
  const blurry = answered.filter((o) => o.blurry);
  const decoys = outcomes.filter((o) => o.expected === null);
  const alerts = (o: ReportOutcome) => (o.ranked[0]?.score ?? 0) >= notifyThreshold;
  return {
    reports: outcomes.length,
    withAnswer: answered.length,
    top1: ratio(ranks.filter((r) => r === 1).length, answered.length),
    top3: ratio(ranks.filter((r) => r !== null && r <= 3).length, answered.length),
    mrr: answered.length > 0 ? ranks.reduce<number>((sum, r) => sum + (r ? 1 / r : 0), 0) / answered.length : null,
    blurry: { n: blurry.length, top3: ratio(blurry.filter((o) => (rankOf(o) ?? 99) <= 3).length, blurry.length) },
    decoys: { n: decoys.length, falseAlertRate: ratio(decoys.filter(alerts).length, decoys.length) },
    wrongTop1Alert: ratio(answered.filter((o) => alerts(o) && o.ranked[0]?.item !== o.expected).length, answered.length),
  };
}

/** Share of pairs whose AI similarity was the same in two runs (§7-4 판정 안정성). */
export function stability(first: ReadonlyMap<string, number>, second: ReadonlyMap<string, number>): { n: number; rate: number | null } {
  const keys = [...first.keys()].filter((k) => second.has(k));
  return { n: keys.length, rate: ratio(keys.filter((k) => first.get(k) === second.get(k)).length, keys.length) };
}

export type ExtractionOutcome = { truthCategory: string; category: string | null; truthColors: string[]; colors: string[]; latencyMs: number };

export function extractionSummary(rows: readonly ExtractionOutcome[]) {
  const latencies = rows.map((r) => r.latencyMs);
  return {
    n: rows.length,
    category: ratio(rows.filter((r) => r.category === r.truthCategory).length, rows.length),
    color: ratio(rows.filter((r) => r.truthColors.every((c) => r.colors.includes(c))).length, rows.length),
    p50Ms: percentile(latencies, 0.5),
    p95Ms: percentile(latencies, 0.95),
  };
}

/** Nearest-rank percentile; null for no values. */
export function percentile(values: readonly number[], p: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(p * sorted.length) - 1))];
}

export const pct = (v: number | null) => (v === null ? "—" : `${Math.round(v * 1000) / 10}%`);
