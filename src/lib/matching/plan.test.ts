import { describe, expect, it } from "vitest";
import { DEFAULT_MATCH_CONFIG } from "./config";
import { planCandidates, type CandidatePlan, type ExistingCandidate, type ScoredPair } from "./plan";

const pair = (itemId: string, score: number | null, extra: Partial<ScoredPair> = {}): ScoredPair => ({
  reportId: "r1",
  itemId,
  score,
  coverage: 1,
  judged: true,
  breakdown: { ai: 0.75 },
  ...extra,
});

const row = (itemId: string, status: ExistingCandidate["status"], score = 0.8, extra: Partial<ExistingCandidate> = {}): ExistingCandidate => ({
  id: `c-${itemId}`,
  reportId: "r1",
  itemId,
  status,
  score,
  coverage: 1,
  notifiedAt: null,
  breakdown: { ai: 0.75, judged: true, tie: false },
  ...extra,
});

/** Applies a plan to an in-memory table, the way run.ts applies it to match_candidates. */
function apply(table: ExistingCandidate[], plan: CandidatePlan): ExistingCandidate[] {
  const next = table.filter((r) => !plan.deletes.includes(r.id));
  for (const w of plan.writes) {
    const existing = next.find((r) => r.reportId === w.reportId && r.itemId === w.itemId);
    if (!existing) {
      next.push({ id: `c-${w.itemId}`, reportId: w.reportId, itemId: w.itemId, status: "suggested", score: w.score, coverage: w.coverage, notifiedAt: null, breakdown: w.breakdown });
    } else if (existing.status === "suggested") {
      Object.assign(existing, { score: w.score, coverage: w.coverage, breakdown: w.breakdown });
    }
  }
  return next.sort((a, b) => a.id.localeCompare(b.id));
}

describe("planCandidates", () => {
  it("저장 임계값 이상인 새 후보만 만든다", () => {
    const plan = planCandidates([pair("a", 0.8), pair("b", 0.3), pair("c", null)], []);
    expect(plan.writes.map((w) => w.itemId)).toEqual(["a"]);
    expect(plan.writes[0].existingId).toBeNull();
  });

  it("분실자가 숨긴 후보는 점수가 높아도 다시 만들지 않는다", () => {
    const plan = planCandidates([pair("a", 0.95)], [row("a", "dismissed")]);
    expect(plan.writes).toEqual([]);
    expect(plan.deletes).toEqual([]);
  });

  it("확인 요청 이후 상태는 건드리지 않는다", () => {
    const plan = planCandidates([pair("a", 0.2)], [row("a", "claimed")]);
    expect(plan).toEqual({ writes: [], deletes: [], notify: [] });
  });

  it("기존 suggested 후보는 점수만 갱신하고, 임계값 아래로 내려가면 지운다", () => {
    const plan = planCandidates([pair("a", 0.6), pair("b", 0.3)], [row("a", "suggested", 0.9), row("b", "suggested", 0.7)]);
    expect(plan.writes).toEqual([expect.objectContaining({ existingId: "c-a", score: 0.6 })]);
    expect(plan.deletes).toEqual(["c-b"]);
  });

  it("신고당 suggested 후보는 점수 상위 5개만 남긴다", () => {
    const scored = ["a", "b", "c", "d", "e", "f"].map((id, i) => pair(id, 0.9 - i * 0.07));
    const plan = planCandidates(scored, [row("z", "suggested", 0.46)]);
    expect(plan.writes.map((w) => w.itemId)).toEqual(["a", "b", "c", "d", "e"]);
    expect(plan.deletes).toEqual(["c-z"]);
  });

  it("상위 후보 점수 차가 0.05 이내면 tie로 표시한다", () => {
    const close = planCandidates([pair("a", 0.9), pair("b", 0.87)], []);
    expect(close.writes.map((w) => w.breakdown.tie)).toEqual([true, true]);
    const apart = planCandidates([pair("a", 0.9), pair("b", 0.8)], []);
    expect(apart.writes.map((w) => w.breakdown.tie)).toEqual([false, false]);
  });

  it("새로 0.70 이상이고 정보 충족도가 충분하며 판정에 성공한 후보만 알린다", () => {
    const plan = planCandidates(
      [
        pair("a", 0.8, { coverage: 0.7 }),
        pair("b", 0.8, { coverage: 0.6 }),
        pair("c", 0.8, { judged: false }),
        pair("d", 0.6),
        pair("e", 0.8),
      ],
      [row("e", "suggested", 0.8, { notifiedAt: "2026-11-25T00:00:00Z" })],
    );
    expect(plan.notify).toEqual([{ reportId: "r1", itemId: "a" }]);
    expect(plan.writes.find((w) => w.itemId === "c")?.breakdown.judged).toBe(false);
  });

  it("같은 점수로 두 번 실행해도 결과가 같다", () => {
    const scored = [pair("a", 0.91234), pair("b", 0.88), pair("c", 0.5, { coverage: 0.66666 }), pair("d", 0.2)];
    const start = [row("d", "dismissed"), row("x", "claimed")];
    const once = apply(structuredClone(start), planCandidates(scored, start));
    const twice = apply(structuredClone(once), planCandidates(scored, once));
    expect(twice).toEqual(once);
    expect(planCandidates(scored, once).writes.every((w) => w.existingId !== null)).toBe(true);
    expect(once.map((r) => [r.itemId, r.status, r.score])).toEqual([
      ["a", "suggested", 0.9123],
      ["b", "suggested", 0.88],
      ["c", "suggested", 0.5],
      ["d", "dismissed", 0.8],
      ["x", "claimed", 0.8],
    ]);
  });

  it("여러 신고를 한 번에 계획해도 신고마다 따로 센다", () => {
    const scored = [pair("a", 0.9), pair("a", 0.9, { reportId: "r2" })];
    const plan = planCandidates(scored, [row("a", "dismissed")], DEFAULT_MATCH_CONFIG);
    expect(plan.writes.map((w) => w.reportId)).toEqual(["r2"]);
  });
});
