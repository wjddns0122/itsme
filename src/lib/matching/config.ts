// Initial matching values. Change them only through the prompt-change skill and record the
// change in docs/05-ai-matching.md §11.

export type SignalKey = "ai" | "category" | "color" | "brand" | "place" | "date";

export type MatchConfig = {
  /** Signal weights, summing to 1 (docs/05-ai-matching.md §5-1). */
  weights: Record<SignalKey, number>;
  /** Allowed AI similarity values (§5-4). */
  aiScale: readonly number[];
  /** Days after lost_to + 1 over which the date score decays to 0. */
  dateDecayDays: number;
  /** Date score multiplier when the item was found before the reported time of day. */
  timeOfDayPenalty: number;
  /** Hours before the time-of-day bucket start that still count as plausible. */
  timeOfDayGraceHours: number;
  /** Both labels at least this confident and in different groups → not a candidate. */
  exclusionConfidence: number;
  /** Score gap within which top candidates count as look-alikes. */
  tieGap: number;
  saveThreshold: number;
  notifyThreshold: number;
  coverageMinNotify: number;
};

export const DEFAULT_MATCH_CONFIG: MatchConfig = {
  weights: { ai: 0.42, category: 0.09, color: 0.054, brand: 0.036, place: 0.25, date: 0.15 },
  aiScale: [0, 0.25, 0.5, 0.75, 1],
  dateDecayDays: 14,
  timeOfDayPenalty: 0.3,
  timeOfDayGraceHours: 1,
  exclusionConfidence: 0.7,
  tieGap: 0.05,
  saveThreshold: 0.45,
  notifyThreshold: 0.7,
  coverageMinNotify: 0.65,
};

export type TimeOfDay = "morning" | "lunch" | "afternoon" | "evening";

/** Start hour (KST) of each time-of-day bucket a person can pick on P-03. */
export const TIME_OF_DAY_START_HOUR: Record<TimeOfDay, number> = {
  morning: 6,
  lunch: 11,
  afternoon: 13,
  evening: 17,
};
