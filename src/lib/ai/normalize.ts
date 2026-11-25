import "server-only";
import { ThinkingLevel } from "@google/genai";
import { REPORT_CATEGORY_VALUES } from "@/lib/validation/report";
import { LostReportNormalizationSchema, type LostReportNormalization } from "@/lib/validation/ai";
import { generateJson, type JsonClient } from "./json";
import { maskPersonalInfo, postProcessDescriptor } from "./postprocess";
import { REPORT_NORMALIZE_PROMPT } from "./prompts";

export type NormalizeInput = {
  description: string;
  secretDetail: string | null;
  userCategory: string | null;
};

export type NormalizeResult =
  | { ok: true; normalization: LostReportNormalization; model: string; latencyMs: number; raw: Record<string, unknown> }
  | { ok: false; model: string; latencyMs: number };

/**
 * §4 분실 설명 정규화. Takes only the description, the secret detail and the picked category:
 * contact details never reach the model, and numbers or emails typed into the text are masked first.
 */
export async function normalizeReport(opts: { client: JsonClient; model: string; input: NormalizeInput }): Promise<NormalizeResult> {
  const started = Date.now();
  const input = {
    description: maskPersonalInfo(opts.input.description),
    secretDetail: opts.input.secretDetail ? maskPersonalInfo(opts.input.secretDetail) : null,
    userCategory: isReportCategory(opts.input.userCategory) ? opts.input.userCategory : null,
  };
  const result = await generateJson({
    client: opts.client,
    kind: "normalize",
    model: opts.model,
    schema: LostReportNormalizationSchema,
    systemInstruction: REPORT_NORMALIZE_PROMPT.system,
    thinkingLevel: ThinkingLevel.LOW,
    contents: [{ role: "user", parts: [{ text: REPORT_NORMALIZE_PROMPT.userText(input) }] }],
  });
  const latencyMs = Date.now() - started;
  if (!result.ok) return { ok: false, model: opts.model, latencyMs };

  return {
    ok: true,
    normalization: postProcessNormalization(result.data),
    model: opts.model,
    latencyMs,
    raw: { prompt: REPORT_NORMALIZE_PROMPT.version, output: result.data, usage: result.usage, attempts: result.attempts },
  };
}

/** The picked category is applied later in reportMatchFields, next to the other picked values. */
export function postProcessNormalization(raw: LostReportNormalization): LostReportNormalization {
  return { ...postProcessDescriptor(raw), language: raw.language.trim().slice(0, 10) || "ko" };
}

function isReportCategory(value: string | null): value is string {
  return value !== null && (REPORT_CATEGORY_VALUES as readonly string[]).includes(value);
}
