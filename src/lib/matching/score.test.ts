import { describe, expect, it } from "vitest";
import { DEFAULT_MATCH_CONFIG } from "./config";
import {
  brandSignal,
  categorySignal,
  colorSignal,
  combineSignals,
  dateSignal,
  findTies,
  placeSignal,
  scoreCandidate,
  shouldNotify,
  snapSimilarity,
  type ScoreInput,
  type ScoreSide,
} from "./score";

const side = (over: Partial<ScoreSide> = {}): ScoreSide => ({
  category: "electronics.earphones",
  colors: ["검정"],
  brand: "Apple",
  confidence: 0.9,
  ...over,
});

const input = (over: Partial<ScoreInput> = {}): ScoreInput => ({
  aiSimilarity: 1,
  a: side(),
  b: side(),
  area: { report: "3층 강의실", item: "3층 강의실" },
  date: { lostFrom: "2026-11-25", lostTo: "2026-11-25", found: "2026-11-25" },
  ...over,
});

describe("snapSimilarity", () => {
  it("snaps to the five-value scale", () => {
    expect(snapSimilarity(0.6)).toBe(0.5);
    expect(snapSimilarity(0.63)).toBe(0.75);
    expect(snapSimilarity(1.2)).toBe(1);
    expect(snapSimilarity(-0.1)).toBe(0);
  });

  it("treats a missing judgement as neutral", () => {
    expect(snapSimilarity(Number.NaN)).toBe(0.5);
  });
});

describe("categorySignal", () => {
  it("scores the same subcategory 1, same group 0.6, different group 0", () => {
    expect(categorySignal(side(), side())).toBe(1);
    expect(categorySignal(side(), side({ category: "electronics.charger" }))).toBe(0.6);
    expect(categorySignal(side(), side({ category: "clothing.gloves" }))).toBe(0);
  });

  it("treats other.other or a missing category as unknown", () => {
    expect(categorySignal(side(), side({ category: "other.other" }))).toBeNull();
    expect(categorySignal(side({ category: null }), side())).toBeNull();
  });
});

describe("colorSignal", () => {
  it("uses Jaccard similarity", () => {
    expect(colorSignal(["검정", "은색"], ["검정"])).toBeCloseTo(0.5);
    expect(colorSignal(["검정", "은색", "흰색"], ["검정", "은색"])).toBeCloseTo(2 / 3);
  });

  it("is unknown when either side has no colors", () => {
    expect(colorSignal([], ["검정"])).toBeNull();
  });
});

describe("brandSignal", () => {
  it("ignores case and spaces", () => {
    expect(brandSignal("Apple", "apple")).toBe(1);
    expect(brandSignal("North Face", "northface")).toBe(1);
    expect(brandSignal("Apple", "Samsung")).toBe(0);
  });

  it("is unknown when either brand is missing", () => {
    expect(brandSignal(null, "Apple")).toBeNull();
    expect(brandSignal("  ", "Apple")).toBeNull();
  });
});

describe("placeSignal", () => {
  it("scores the same area 1 and a different area 0.5", () => {
    expect(placeSignal("리프트 A", "리프트 A")).toBe(1);
    expect(placeSignal("리프트 A", "렌탈샵")).toBe(0.5);
  });

  it("is unknown when the person does not remember the area", () => {
    expect(placeSignal(null, "리프트 A")).toBeNull();
  });
});

describe("dateSignal", () => {
  const window = { lostFrom: "2026-11-24", lostTo: "2026-11-25" };

  it("is 1 inside the loss window with one day of slack on both sides", () => {
    expect(dateSignal({ ...window, found: "2026-11-23" })).toBe(1);
    expect(dateSignal({ ...window, found: "2026-11-25" })).toBe(1);
    expect(dateSignal({ ...window, found: "2026-11-26" })).toBe(1);
  });

  it("decays linearly over 14 days after lost_to + 1", () => {
    expect(dateSignal({ ...window, found: "2026-11-28" })).toBeCloseTo(1 - 2 / 14);
    expect(dateSignal({ ...window, found: "2026-12-10" })).toBe(0);
  });

  it("returns null when found more than a day before the loss window", () => {
    expect(dateSignal({ ...window, found: "2026-11-22" })).toBeNull();
  });

  it("penalizes an item found clearly before the reported time of day", () => {
    const day = { lostFrom: "2026-11-25", lostTo: "2026-11-25", found: "2026-11-25", lostTimeOfDay: "afternoon" as const };
    expect(dateSignal({ ...day, foundTime: "10:00" })).toBeCloseTo(0.3);
    expect(dateSignal({ ...day, foundTime: "12:30" })).toBe(1);
    expect(dateSignal({ ...day, foundTime: "15:00" })).toBe(1);
  });
});

describe("combineSignals", () => {
  it("matches the docs example 1 (all signals known): 0.922", () => {
    const { score, coverage } = combineSignals({
      ai: 0.92, category: 0.92, color: 0.92, brand: 0.92, place: 1, date: 0.8,
    });
    expect(coverage).toBeCloseTo(1);
    expect(score).toBeCloseTo(0.922, 3);
  });

  it("matches the docs example 2 (area and brand unknown): coverage 0.714, score 0.853", () => {
    const { score, coverage, known } = combineSignals({
      ai: 0.75, category: 1, color: 1, brand: null, place: null, date: 1,
    });
    expect(coverage).toBeCloseTo(0.714, 3);
    expect(score).toBeCloseTo(0.853, 3);
    expect(known).toEqual(["ai", "category", "color", "date"]);
  });

  it("keeps coverage at 0.57 when only the AI judgement and the date are known", () => {
    const { coverage } = combineSignals({ ai: 0.5, category: null, color: null, brand: null, place: null, date: 1 });
    expect(coverage).toBeCloseTo(0.57, 3);
  });

  it("weights sum to 1", () => {
    const total = Object.values(DEFAULT_MATCH_CONFIG.weights).reduce((a, b) => a + b, 0);
    expect(total).toBeCloseTo(1);
  });
});

describe("scoreCandidate", () => {
  it("gives a perfect match score 1 and coverage 1", () => {
    const result = scoreCandidate(input());
    expect(result.excluded).toBe(false);
    if (!result.excluded) {
      expect(result.score).toBeCloseTo(1);
      expect(result.coverage).toBeCloseTo(1);
    }
  });

  it("excludes confidently different groups", () => {
    const result = scoreCandidate(input({ b: side({ category: "clothing.gloves" }) }));
    expect(result).toEqual({ excluded: true, reason: "category_mismatch" });
  });

  it("keeps different groups when a label is not confident", () => {
    const result = scoreCandidate(input({ b: side({ category: "clothing.gloves", confidence: 0.4 }) }));
    expect(result.excluded).toBe(false);
    if (!result.excluded) expect(result.breakdown.category).toBe(0);
  });

  it("excludes items found before the loss", () => {
    const result = scoreCandidate(input({ date: { lostFrom: "2026-11-25", lostTo: "2026-11-25", found: "2026-11-20" } }));
    expect(result).toEqual({ excluded: true, reason: "date_before_loss" });
  });

  it("does not punish unknown answers: same AI judgement scores the same with fewer known signals", () => {
    const full = scoreCandidate(input());
    const fuzzy = scoreCandidate(input({
      a: side({ colors: [], brand: null }),
      area: { report: null, item: "3층 강의실" },
    }));
    if (full.excluded || fuzzy.excluded) throw new Error("unexpected exclusion");
    expect(fuzzy.score).toBeCloseTo(full.score);
    expect(fuzzy.coverage).toBeLessThan(full.coverage);
  });
});

describe("findTies", () => {
  it("marks look-alikes within the gap of the best score", () => {
    expect(findTies([0.82, 0.8, 0.6])).toEqual([true, true, false]);
  });

  it("marks nothing when the best score stands alone", () => {
    expect(findTies([0.9, 0.7])).toEqual([false, false]);
    expect(findTies([0.9])).toEqual([false]);
  });
});

describe("shouldNotify", () => {
  it("needs both a high score and enough coverage", () => {
    expect(shouldNotify(0.8, 0.9)).toBe(true);
    expect(shouldNotify(0.8, 0.6)).toBe(false);
    expect(shouldNotify(0.6, 0.9)).toBe(false);
  });
});
