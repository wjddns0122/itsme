import { z } from "zod";
import { CATEGORIES, categoryGroup } from "./constants";

// 소유권 확인 질문 (docs/05-ai-matching.md §9-1). Questions depend on the category only, never on
// the item, so asking them reveals nothing about its private features. Texts: messages/ko.json
// public.claim.questions.

export const CLAIM_QUESTION_KEYS = [
  "screen_case",
  "back_attached",
  "appearance",
  "case_attached",
  "contents",
  "attached",
  "worn",
  "brand_size",
  "marks",
  "damage",
  "last_used",
] as const;
export type ClaimQuestionKey = (typeof CLAIM_QUESTION_KEYS)[number];

/** Proof to bring when picking the item up; shown to admins on approval (A-06). */
export type RequiredProof = "unlock_serial" | "id_check" | null;

const HIGH_VALUE_ELECTRONICS = new Set(["electronics.phone", "electronics.laptop_tablet", "electronics.watch"]);

export function claimQuestionsFor(category: string): ClaimQuestionKey[] {
  if (HIGH_VALUE_ELECTRONICS.has(category)) return ["screen_case", "back_attached", "last_used"];
  switch (categoryGroup(category)) {
    case "electronics":
      return ["appearance", "case_attached", "last_used"];
    case "wallet_card":
      return ["contents", "appearance", "last_used"];
    case "bag":
      return ["contents", "attached", "worn"];
    case "clothing":
    case "sports":
      return ["brand_size", "marks", "damage"];
    default:
      return ["appearance", "attached", "last_used"];
  }
}

export function requiredProofFor(category: string): RequiredProof {
  if (HIGH_VALUE_ELECTRONICS.has(category)) return "unlock_serial";
  if (categoryGroup(category) === "wallet_card") return "id_check";
  return null;
}

/** P-05 "받으러 오실 때 잠금 해제나 일련번호 확인이 필요해요." */
export function isHighValueCategory(category: string): boolean {
  return CATEGORIES.some((c) => c.code === category && c.highValue);
}

export const CLAIM_LIMITS = { answer: 300, proofReply: 500 } as const;

/** Answers keyed by question; at least one must be filled in (docs/03 P-05). */
export const ClaimAnswersSchema = z
  .partialRecord(z.enum(CLAIM_QUESTION_KEYS), z.string().trim().max(CLAIM_LIMITS.answer))
  .refine((a) => Object.values(a).some((v) => v.length > 0), { message: "answer_required" });

export const ProofReplySchema = z.string().trim().min(1).max(CLAIM_LIMITS.proofReply);
