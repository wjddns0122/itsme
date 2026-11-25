import "server-only";
import { GoogleGenAI } from "@google/genai";
import { z } from "zod";

// docs/05-ai-matching.md §8, ADR-024, ADR-025
const AiEnvSchema = z.object({
  GEMINI_API_KEY: z.string().min(1, "GEMINI_API_KEY is not set"),
  VISION_MODEL: z.string().min(1, "VISION_MODEL is not set"),
  LLM_MODEL: z.string().min(1, "LLM_MODEL is not set"),
  GEMINI_TIER: z.enum(["free", "paid"]).default("free"),
});

export type AiEnv = z.infer<typeof AiEnvSchema>;

export const FREE_TIER_WARNING =
  "[ai] GEMINI_TIER=free: Google may use inputs to improve its products. Send team test data only, never real reports or photos (ADR-025).";

/**
 * Reads the AI settings. On the production deployment a free-tier key is refused (ADR-025): callers
 * then take the "AI unavailable" path (raw text, neutral similarity) instead of sending real reports.
 */
export function readAiEnv(source: Record<string, string | undefined> = process.env): AiEnv {
  const env = AiEnvSchema.parse(source);
  if (source.VERCEL_ENV === "production" && env.GEMINI_TIER !== "paid") {
    throw new Error("GEMINI_TIER must be paid in production (ADR-025)");
  }
  return env;
}

let cached: { client: GoogleGenAI; env: AiEnv } | null = null;

/** Lazily creates the single Gemini client for the server. */
export function getAi(): { client: GoogleGenAI; env: AiEnv } {
  if (!cached) {
    const env = readAiEnv();
    if (env.GEMINI_TIER === "free") console.warn(FREE_TIER_WARNING);
    cached = { client: new GoogleGenAI({ apiKey: env.GEMINI_API_KEY }), env };
  }
  return cached;
}
