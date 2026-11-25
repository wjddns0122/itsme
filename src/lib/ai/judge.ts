import "server-only";
import { ThinkingLevel } from "@google/genai";
import { DEFAULT_MATCH_CONFIG, type MatchConfig } from "@/lib/matching/config";
import { snapSimilarity } from "@/lib/matching/score";
import { SimilarityJudgementSchema } from "@/lib/validation/ai";
import { generateJson, type JsonClient } from "./json";
import { maskPersonalInfo } from "./postprocess";
import { SIMILARITY_JUDGE_PROMPT } from "./prompts";

export type JudgeCandidate = { id: string; text: string };

/** `judged: false` means the batch failed and `similarity` is the neutral value (no notification). */
export type Judgement = { similarity: number; matched: string[]; conflicts: string[]; judged: boolean };

const REASONS_MAX = 5;
const REASON_LENGTH = 60;

/**
 * §5-4 AI 유사도 판정: compares one base text with up to 60 candidates, 20 per call, in parallel.
 * Texts are built by buildSearchText and masked again here; contact details are never part of them.
 */
export async function judgeSimilarity(opts: {
  client: JsonClient;
  model: string;
  base: string;
  candidates: readonly JudgeCandidate[];
  config?: MatchConfig;
}): Promise<Map<string, Judgement>> {
  const config = opts.config ?? DEFAULT_MATCH_CONFIG;
  const list = opts.candidates.slice(0, config.judgeMaxCandidates);
  const batches: JudgeCandidate[][] = [];
  for (let i = 0; i < list.length; i += config.judgeBatch) batches.push(list.slice(i, i + config.judgeBatch));

  const results = await Promise.all(batches.map((batch) => judgeBatch({ ...opts, config, batch })));
  return new Map(results.flat());
}

async function judgeBatch(opts: {
  client: JsonClient;
  model: string;
  base: string;
  batch: readonly JudgeCandidate[];
  config: MatchConfig;
}): Promise<[string, Judgement][]> {
  const keyed = opts.batch.map((c, i) => ({ key: `C${i + 1}`, id: c.id, text: maskPersonalInfo(c.text) }));
  const result = await generateJson({
    client: opts.client,
    kind: "judge",
    model: opts.model,
    schema: SimilarityJudgementSchema,
    systemInstruction: SIMILARITY_JUDGE_PROMPT.system,
    thinkingLevel: ThinkingLevel.LOW,
    contents: [{ role: "user", parts: [{ text: SIMILARITY_JUDGE_PROMPT.userText(maskPersonalInfo(opts.base), keyed) }] }],
  });

  const byKey = new Map(result.ok ? result.data.results.map((r) => [r.id.trim(), r]) : []);
  return keyed.map(({ key, id }) => {
    const r = byKey.get(key);
    if (!r) return [id, { similarity: opts.config.neutralSimilarity, matched: [], conflicts: [], judged: false }];
    return [id, { similarity: snapSimilarity(r.similarity, opts.config.aiScale), matched: reasons(r.matched), conflicts: reasons(r.conflicts), judged: true }];
  });
}

const reasons = (list: readonly string[]) =>
  list
    .map((s) => maskPersonalInfo(s.trim()).slice(0, REASON_LENGTH))
    .filter(Boolean)
    .slice(0, REASONS_MAX);
