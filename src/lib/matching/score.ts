// Candidate scoring (docs/05-ai-matching.md §5). Pure: no DB, no network.
// Unknown signals are left out of the score instead of counting as 0, and the weight of the
// signals that were actually compared is returned separately as `coverage`.

import { categoryGroup, UNKNOWN_CATEGORY } from "@/lib/validation/constants";
import {
  DEFAULT_MATCH_CONFIG,
  TIME_OF_DAY_START_HOUR,
  type MatchConfig,
  type SignalKey,
  type TimeOfDay,
} from "./config";

export type ScoreSide = {
  category: string | null;
  colors: string[];
  brand: string | null;
  confidence: number | null;
};

export type ScoreInput = {
  /** Gemini similarity judgement (§5-4). Snapped to the allowed scale. */
  aiSimilarity: number;
  /** a = lost report, b = found item. */
  a: ScoreSide;
  b: ScoreSide;
  area: { report: string | null; item: string | null };
  date: {
    lostFrom: string; // YYYY-MM-DD (KST)
    lostTo: string;
    found: string;
    foundTime?: string; // HH:mm (KST)
    lostTimeOfDay?: TimeOfDay | null;
  };
};

export type Signals = Record<SignalKey, number | null>;

export type ScoreResult =
  | { excluded: true; reason: "category_mismatch" | "date_before_loss" }
  | {
      excluded: false;
      score: number;
      coverage: number;
      breakdown: Signals & { ai: number; date: number; known: SignalKey[] };
    };

const SIGNAL_KEYS: SignalKey[] = ["ai", "category", "color", "brand", "place", "date"];
const MS_PER_DAY = 86_400_000;

export function snapSimilarity(value: number, scale: readonly number[] = DEFAULT_MATCH_CONFIG.aiScale): number {
  if (!Number.isFinite(value)) return 0.5;
  return scale.reduce((best, s) => (Math.abs(s - value) < Math.abs(best - value) ? s : best), scale[0]);
}

export function categorySignal(a: ScoreSide, b: ScoreSide): number | null {
  if (!a.category || !b.category) return null;
  if (a.category === UNKNOWN_CATEGORY || b.category === UNKNOWN_CATEGORY) return null;
  if (a.category === b.category) return 1;
  if (categoryGroup(a.category) === categoryGroup(b.category)) return 0.6;
  return 0;
}

export function colorSignal(a: string[], b: string[]): number | null {
  if (a.length === 0 || b.length === 0) return null;
  const setA = new Set(a);
  const setB = new Set(b);
  const intersection = [...setA].filter((c) => setB.has(c)).length;
  const union = new Set([...setA, ...setB]).size;
  return intersection / union;
}

const normalizeBrand = (brand: string) => brand.toLowerCase().replace(/\s+/g, "");

export function brandSignal(a: string | null, b: string | null): number | null {
  if (!a?.trim() || !b?.trim()) return null;
  return normalizeBrand(a) === normalizeBrand(b) ? 1 : 0;
}

export function placeSignal(report: string | null, item: string | null): number | null {
  if (!report?.trim() || !item?.trim()) return null;
  return report.trim() === item.trim() ? 1 : 0.5;
}

const toDay = (ymd: string) => {
  const [y, m, d] = ymd.split("-").map(Number);
  return Date.UTC(y, m - 1, d) / MS_PER_DAY;
};

const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

/** Returns null when the item was found more than a day before the loss window starts. */
export function dateSignal(date: ScoreInput["date"], config: MatchConfig = DEFAULT_MATCH_CONFIG): number | null {
  const from = toDay(date.lostFrom);
  const to = toDay(date.lostTo);
  const found = toDay(date.found);
  if (found < from - 1) return null;

  let value = found <= to + 1 ? 1 : Math.max(0, 1 - (found - (to + 1)) / config.dateDecayDays);

  // Same single day, but found clearly before the time the person last had it.
  if (date.lostTimeOfDay && date.foundTime && from === to && found === to) {
    const bucketStart = TIME_OF_DAY_START_HOUR[date.lostTimeOfDay] * 60;
    if (toMinutes(date.foundTime) < bucketStart - config.timeOfDayGraceHours * 60) {
      value *= config.timeOfDayPenalty;
    }
  }
  return value;
}

function isConfidentMismatch(a: ScoreSide, b: ScoreSide, config: MatchConfig): boolean {
  if (!a.category || !b.category) return false;
  const groupA = categoryGroup(a.category);
  const groupB = categoryGroup(b.category);
  const unknownGroup = categoryGroup(UNKNOWN_CATEGORY);
  return (
    groupA !== groupB &&
    groupA !== unknownGroup &&
    groupB !== unknownGroup &&
    (a.confidence ?? 0) >= config.exclusionConfidence &&
    (b.confidence ?? 0) >= config.exclusionConfidence
  );
}

/** Weighted average over the known signals, plus the weight those signals cover. */
export function combineSignals(
  signals: Signals,
  weights: Record<SignalKey, number> = DEFAULT_MATCH_CONFIG.weights,
): { score: number; coverage: number; known: SignalKey[] } {
  const known = SIGNAL_KEYS.filter((k) => signals[k] !== null);
  const coverage = known.reduce((sum, k) => sum + weights[k], 0);
  if (coverage === 0) return { score: 0, coverage: 0, known };
  const weighted = known.reduce((sum, k) => sum + weights[k] * (signals[k] as number), 0);
  return { score: weighted / coverage, coverage, known };
}

export function scoreCandidate(input: ScoreInput, config: MatchConfig = DEFAULT_MATCH_CONFIG): ScoreResult {
  if (isConfidentMismatch(input.a, input.b, config)) {
    return { excluded: true, reason: "category_mismatch" };
  }
  const date = dateSignal(input.date, config);
  if (date === null) {
    return { excluded: true, reason: "date_before_loss" };
  }

  const signals = {
    ai: snapSimilarity(input.aiSimilarity, config.aiScale),
    category: categorySignal(input.a, input.b),
    color: colorSignal(input.a.colors, input.b.colors),
    brand: brandSignal(input.a.brand, input.b.brand),
    place: placeSignal(input.area.report, input.area.item),
    date,
  };
  const { score, coverage, known } = combineSignals(signals, config.weights);
  return { excluded: false, score, coverage, breakdown: { ...signals, known } };
}

/** Marks candidates whose score is within `gap` of the best one, when there are at least two. */
export function findTies(scores: number[], gap: number = DEFAULT_MATCH_CONFIG.tieGap): boolean[] {
  if (scores.length < 2) return scores.map(() => false);
  const best = Math.max(...scores);
  const close = scores.map((s) => best - s <= gap + Number.EPSILON);
  const count = close.filter(Boolean).length;
  return count >= 2 ? close : scores.map(() => false);
}

export function shouldNotify(score: number, coverage: number, config: MatchConfig = DEFAULT_MATCH_CONFIG): boolean {
  return score >= config.notifyThreshold && coverage >= config.coverageMinNotify;
}
