import { describe, expect, it } from "vitest";
import { extractionSummary, percentile, rankOf, stability, summarize, type ReportOutcome } from "./metrics";

const outcome = (key: string, expected: string | null, ranked: [string, number][], extra: Partial<ReportOutcome> = {}): ReportOutcome => ({
  key,
  split: "dev",
  expected,
  blurry: false,
  ranked: ranked.map(([item, score]) => ({ item, score })),
  ...extra,
});

describe("summarize", () => {
  const outcomes = [
    outcome("R1", "I1", [["I1", 0.9], ["I2", 0.5]]),
    outcome("R2", "I2", [["I3", 0.8], ["I4", 0.6], ["I2", 0.55]]),
    outcome("R3", "I5", [["I6", 0.6]], { blurry: true }),
    outcome("R4", null, [["I1", 0.75]]),
    outcome("R5", null, [["I2", 0.5]]),
  ];
  const s = summarize(outcomes, 0.7);

  it("Top-1·Top-3·MRR은 정답이 있는 신고만 센다", () => {
    expect(s.withAnswer).toBe(3);
    expect(s.top1).toBeCloseTo(1 / 3);
    expect(s.top3).toBeCloseTo(2 / 3);
    expect(s.mrr).toBeCloseTo((1 + 1 / 3 + 0) / 3);
  });

  it("미끼 신고에서 0.70 이상 후보가 생기면 오알림", () => {
    expect(s.decoys).toEqual({ n: 2, falseAlertRate: 0.5 });
  });

  it("흐린 신고와 잘못된 1위 알림을 따로 센다", () => {
    expect(s.blurry).toEqual({ n: 1, top3: 0 });
    expect(s.wrongTop1Alert).toBeCloseTo(1 / 3);
  });

  it("정답 순위", () => {
    expect(rankOf(outcomes[1])).toBe(3);
    expect(rankOf(outcomes[2])).toBeNull();
  });
});

describe("stability / extraction / percentile", () => {
  it("두 번 판정한 값이 같은 쌍의 비율", () => {
    expect(stability(new Map([["a", 0.75], ["b", 0.5]]), new Map([["a", 0.75], ["b", 1], ["c", 0]]))).toEqual({ n: 2, rate: 0.5 });
  });

  it("분류 정확도와 색상 포함률, 지연 p50·p95", () => {
    const e = extractionSummary([
      { truthCategory: "bag.bag", category: "bag.bag", truthColors: ["검정"], colors: ["검정", "회색"], latencyMs: 2000 },
      { truthCategory: "key.key", category: "other.other", truthColors: ["은색"], colors: [], latencyMs: 6000 },
    ]);
    expect(e).toMatchObject({ n: 2, category: 0.5, color: 0.5, p50Ms: 2000, p95Ms: 6000 });
    expect(percentile([], 0.5)).toBeNull();
  });
});
