import "server-only";
import {
  FinishReason,
  type ContentListUnion,
  type GenerateContentParameters,
  type GenerateContentResponse,
  type ThinkingLevel,
} from "@google/genai";
import { z } from "zod";
import { logAiCall, type AiKind } from "./log";

// One call plus one retry (docs/05-ai-matching.md §8).
const MAX_ATTEMPTS = 2;
const DEFAULT_TIMEOUT_MS = 15_000;

export type JsonClient = {
  models: { generateContent(params: GenerateContentParameters): Promise<GenerateContentResponse> };
};

export type JsonError = "request_failed" | "not_finished" | "empty_response" | "invalid_json" | "schema_mismatch";

export type JsonResult<T> = { ok: true; data: T; attempts: number } | { ok: false; error: JsonError; attempts: number };

export type GenerateJsonOptions<S extends z.ZodType> = {
  client: JsonClient;
  kind: AiKind;
  model: string;
  schema: S;
  contents: ContentListUnion;
  systemInstruction?: string;
  thinkingLevel?: ThinkingLevel;
  timeoutMs?: number;
};

/** Checks one response: it must have finished normally, be JSON, and match the schema. */
export function interpretResponse<S extends z.ZodType>(
  response: Pick<GenerateContentResponse, "text" | "candidates">,
  schema: S,
): { ok: true; data: z.output<S> } | { ok: false; error: JsonError } {
  const finishReason = response.candidates?.[0]?.finishReason;
  if (finishReason && finishReason !== FinishReason.STOP) return { ok: false, error: "not_finished" };

  const text = response.text?.trim();
  if (!text) return { ok: false, error: "empty_response" };

  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: "invalid_json" };
  }

  const parsed = schema.safeParse(raw);
  return parsed.success ? { ok: true, data: parsed.data } : { ok: false, error: "schema_mismatch" };
}

/**
 * Asks Gemini for JSON that matches `schema` (structured output). Never sends temperature,
 * topP or topK: Gemini 4 and 3.6+ ignore them and will reject them later.
 */
export async function generateJson<S extends z.ZodType>(opts: GenerateJsonOptions<S>): Promise<JsonResult<z.output<S>>> {
  const responseJsonSchema = z.toJSONSchema(opts.schema);
  let lastError: JsonError = "request_failed";

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const started = Date.now();
    try {
      const response = await opts.client.models.generateContent({
        model: opts.model,
        contents: opts.contents,
        config: {
          responseMimeType: "application/json",
          responseJsonSchema,
          ...(opts.systemInstruction ? { systemInstruction: opts.systemInstruction } : {}),
          ...(opts.thinkingLevel ? { thinkingConfig: { thinkingLevel: opts.thinkingLevel } } : {}),
          httpOptions: { timeout: opts.timeoutMs ?? DEFAULT_TIMEOUT_MS },
        },
      });
      const result = interpretResponse(response, opts.schema);
      logAiCall({
        kind: opts.kind,
        model: opts.model,
        attempt,
        latency_ms: Date.now() - started,
        ok: result.ok,
        finish_reason: response.candidates?.[0]?.finishReason,
        usage: response.usageMetadata,
        ...(result.ok ? {} : { error: result.error }),
      });
      if (result.ok) return { ok: true, data: result.data, attempts: attempt };
      lastError = result.error;
    } catch {
      lastError = "request_failed";
      logAiCall({ kind: opts.kind, model: opts.model, attempt, latency_ms: Date.now() - started, ok: false, error: lastError });
    }
  }
  return { ok: false, error: lastError, attempts: MAX_ATTEMPTS };
}
