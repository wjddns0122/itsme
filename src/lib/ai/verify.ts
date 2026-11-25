import "server-only";
import { ThinkingLevel } from "@google/genai";
import { OwnershipVerdictSchema, VERDICT_KEYS, type OwnershipVerdict } from "@/lib/validation/ai";
import { generateJson, type JsonClient } from "./json";
import { maskPersonalInfo } from "./postprocess";
import { OWNERSHIP_VERIFY_PROMPT, type VerifyInput } from "./prompts";

const NOTE_LENGTH = 80;

/**
 * §9 소유권 확인 보조: compares the answers with the item's private features for the admin (A-06).
 * Contact details are not part of the input. The result never decides anything (ADR-007).
 */
export async function verifyOwnership(opts: { client: JsonClient; model: string; input: VerifyInput }): Promise<{ ok: true; verdict: OwnershipVerdict; raw: Record<string, unknown> } | { ok: false }> {
  const input: VerifyInput = {
    ...opts.input,
    description: maskPersonalInfo(opts.input.description),
    secretDetail: opts.input.secretDetail ? maskPersonalInfo(opts.input.secretDetail) : null,
    proofReply: opts.input.proofReply ? maskPersonalInfo(opts.input.proofReply) : null,
    answers: opts.input.answers.map((a) => ({ question: a.question, answer: maskPersonalInfo(a.answer) })),
  };
  const result = await generateJson({
    client: opts.client,
    kind: "verify",
    model: opts.model,
    schema: OwnershipVerdictSchema,
    systemInstruction: OWNERSHIP_VERIFY_PROMPT.system,
    thinkingLevel: ThinkingLevel.LOW,
    contents: [{ role: "user", parts: [{ text: OWNERSHIP_VERIFY_PROMPT.userText(input) }] }],
  });
  if (!result.ok) return { ok: false };
  return { ok: true, verdict: postProcessVerdict(result.data), raw: { prompt: OWNERSHIP_VERIFY_PROMPT.version, usage: result.usage } };
}

/** One row per item key in a fixed order (missing ones are "unknown"), notes masked and short. */
export function postProcessVerdict(raw: OwnershipVerdict): OwnershipVerdict {
  const byKey = new Map(raw.items.map((i) => [i.key, i]));
  return {
    items: VERDICT_KEYS.map((key) => {
      const item = byKey.get(key);
      return { key, result: item?.result ?? "unknown", note: maskPersonalInfo((item?.note ?? "").trim()).slice(0, NOTE_LENGTH) };
    }),
    insufficient: raw.insufficient,
    summary: maskPersonalInfo(raw.summary.trim()).slice(0, NOTE_LENGTH * 2),
  };
}
