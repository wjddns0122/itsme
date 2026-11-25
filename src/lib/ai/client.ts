import "server-only";
import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { isIsoDate, seoulToday } from "@/lib/dates";

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
 * Whether this deployment may send data to Gemini with this key (ADR-025). Production needs a paid
 * key, except during the hackathon demo: GEMINI_FREE_DEMO_UNTIL (a Seoul date, inclusive) lets a
 * free key serve production until that day ends, with team test data only.
 */
export function tierAllowed(source: Record<string, string | undefined>, tier: AiEnv["GEMINI_TIER"], now: Date = new Date()): boolean {
  if (source.VERCEL_ENV !== "production" || tier === "paid") return true;
  const until = source.GEMINI_FREE_DEMO_UNTIL?.trim();
  return Boolean(until && isIsoDate(until) && seoulToday(now) <= until);
}

/**
 * Reads the AI settings. When the key may not be used here, callers take the "AI unavailable" path
 * (raw text, neutral similarity) instead of sending real reports.
 */
export function readAiEnv(source: Record<string, string | undefined> = process.env, now: Date = new Date()): AiEnv {
  const env = AiEnvSchema.parse(source);
  if (!tierAllowed(source, env.GEMINI_TIER, now)) {
    throw new Error("GEMINI_TIER must be paid in production (ADR-025)");
  }
  return env;
}

let cached: { client: GoogleGenAI; env: AiEnv } | null = null;

/** Lazily creates the single Gemini client for the server. The tier is checked on every call, so a
 * demo window that ends stops AI even in a server instance that is still warm. */
export function getAi(): { client: GoogleGenAI; env: AiEnv } {
  if (cached && !tierAllowed(process.env, cached.env.GEMINI_TIER)) {
    throw new Error("GEMINI_TIER must be paid in production (ADR-025)");
  }
  if (!cached) {
    const env = readAiEnv();
    if (env.GEMINI_TIER === "free") console.warn(FREE_TIER_WARNING);
    cached = { client: new GoogleGenAI({ apiKey: env.GEMINI_API_KEY }), env };
  }
  return cached;
}
