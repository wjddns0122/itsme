import { z } from "zod";
import { CATEGORY_CODES, COLORS } from "./constants";

// AI output schemas: docs/05-ai-matching.md §2-3. The schema sent to Gemini stays simple;
// counts and ranges are enforced in code after parsing (lib/ai/postprocess.ts).

export const ItemDescriptorSchema = z.object({
  category: z.enum(CATEGORY_CODES),
  subcategory: z.string().nullable(),
  colors: z.array(z.enum(COLORS)),
  brand: z.string().nullable(),
  material: z.string().nullable(),
  features: z.array(z.string()),
  confidence: z.number(),
});

export const FoundItemExtractionSchema = ItemDescriptorSchema.extend({
  public_summary: z.string(),
  private_features: z.array(z.string()),
  is_sensitive: z.boolean(),
});

export const LostReportNormalizationSchema = ItemDescriptorSchema.extend({
  language: z.string(),
});

/** §5-4 AI 유사도 판정. `id` is the short key (C1, C2 …) the code maps back to a real id. */
export const SimilarityJudgementSchema = z.object({
  results: z.array(
    z.object({
      id: z.string(),
      similarity: z.number(),
      matched: z.array(z.string()),
      conflicts: z.array(z.string()),
    }),
  ),
});

/** §9-2 소유권 답변 비교. Admin only: never on the person's page, in emails or in rejection notes. */
export const VERDICT_KEYS = ["appearance", "marks", "contents", "place_time", "serial"] as const;
export const OwnershipVerdictSchema = z.object({
  items: z.array(z.object({ key: z.enum(VERDICT_KEYS), result: z.enum(["match", "mismatch", "unknown"]), note: z.string() })),
  insufficient: z.boolean(),
  summary: z.string(),
});

export type ItemDescriptor = z.infer<typeof ItemDescriptorSchema>;
export type FoundItemExtraction = z.infer<typeof FoundItemExtractionSchema>;
export type LostReportNormalization = z.infer<typeof LostReportNormalizationSchema>;
export type SimilarityJudgement = z.infer<typeof SimilarityJudgementSchema>;
export type OwnershipVerdict = z.infer<typeof OwnershipVerdictSchema>;
