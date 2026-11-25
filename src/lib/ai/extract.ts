import "server-only";
import { ThinkingLevel } from "@google/genai";
import { FoundItemExtractionSchema, type FoundItemExtraction } from "@/lib/validation/ai";
import { generateJson, type JsonClient } from "./json";
import { postProcessExtraction } from "./postprocess";
import { PHOTO_EXTRACT_PROMPT } from "./prompts";

export type PhotoInput = { mimeType: string; base64: string };

export type ExtractionResult =
  | { ok: true; extraction: FoundItemExtraction; model: string; latencyMs: number; raw: Record<string, unknown> }
  | { ok: false; model: string; latencyMs: number };

/**
 * §3 습득물 사진 분석: 1–3 photos plus facility type and area in, a post-processed extraction out.
 * Failure (after one retry inside generateJson) returns ok: false so the form falls back to manual entry.
 */
export async function extractFoundItem(opts: {
  client: JsonClient;
  model: string;
  photos: readonly PhotoInput[];
  facilityType: string;
  foundArea: string | null;
}): Promise<ExtractionResult> {
  const started = Date.now();
  const result = await generateJson({
    client: opts.client,
    kind: "extract",
    model: opts.model,
    schema: FoundItemExtractionSchema,
    systemInstruction: PHOTO_EXTRACT_PROMPT.system,
    thinkingLevel: ThinkingLevel.LOW,
    contents: [
      {
        role: "user",
        parts: [
          ...opts.photos.map((p) => ({ inlineData: { mimeType: p.mimeType, data: p.base64 } })),
          { text: PHOTO_EXTRACT_PROMPT.userText(opts.facilityType, opts.foundArea) },
        ],
      },
    ],
  });
  const latencyMs = Date.now() - started;
  if (!result.ok) return { ok: false, model: opts.model, latencyMs };

  return {
    ok: true,
    extraction: postProcessExtraction(result.data),
    model: opts.model,
    latencyMs,
    raw: { prompt: PHOTO_EXTRACT_PROMPT.version, output: result.data, usage: result.usage, attempts: result.attempts },
  };
}
