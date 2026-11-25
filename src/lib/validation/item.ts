import { z } from "zod";
import { CATEGORY_CODES, COLORS } from "./constants";

// A-03 습득물 등록 input (docs/03-screens.md A-03, docs/04-architecture.md §6-1).

export const ITEM_LIMITS = { subcategory: 40, brand: 40, summary: 200, privateText: 500, area: 60, storage: 60, photos: 3, colors: 5, features: 8 } as const;

/** Photos the server accepts: already resized on the client (1280px JPEG), so 5MB is generous. */
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .transform((v) => (v ? v : null));

/** The AI result the client sends back with the form, so the server can store it (admin only). */
export const ExtractionMetaSchema = z.object({
  features: z.array(z.string().max(100)).max(ITEM_LIMITS.features),
  material: z.string().max(40).nullable(),
  confidence: z.number().min(0).max(1),
  model: z.string().max(80),
  latencyMs: z.number().int().nonnegative(),
  raw: z.record(z.string(), z.unknown()),
});

export const FoundItemFormSchema = z.object({
  category: z.enum(CATEGORY_CODES),
  subcategory: optionalText(ITEM_LIMITS.subcategory),
  colors: z.array(z.enum(COLORS)).max(ITEM_LIMITS.colors),
  brand: optionalText(ITEM_LIMITS.brand),
  publicSummary: z.string().trim().min(1).max(ITEM_LIMITS.summary),
  privateFeatures: z.string().max(ITEM_LIMITS.privateText),
  isSensitive: z.boolean(),
  foundAt: z.string(),
  foundArea: optionalText(ITEM_LIMITS.area),
  storageLocation: optionalText(ITEM_LIMITS.storage),
  photoPaths: z.array(z.string().max(200)).max(ITEM_LIMITS.photos),
  extraction: ExtractionMetaSchema.nullable(),
  registerStartedAt: z.iso.datetime().nullable(),
});

export type FoundItemForm = z.input<typeof FoundItemFormSchema>;

export const SensitiveItemSchema = z.object({
  category: z.enum(CATEGORY_CODES),
  foundAt: z.string(),
  foundArea: optionalText(ITEM_LIMITS.area),
  storageLocation: optionalText(ITEM_LIMITS.storage),
  registerStartedAt: z.iso.datetime().nullable(),
});

/** "흠집, 이니셜\nM.K" → ["흠집", "이니셜", "M.K"]: one feature per line or comma, at most 8. */
export function splitFeatures(text: string): string[] {
  return text
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, ITEM_LIMITS.features);
}

/** Below this confidence a quickly registered item goes to the "확인 필요" tab (docs/04 §6-1). */
export const REVIEW_CONFIDENCE = 0.6;

/** A-05 [수정]: the same fields as registration, without photos and AI metadata. */
export const UpdateItemSchema = FoundItemFormSchema.pick({
  category: true,
  subcategory: true,
  colors: true,
  brand: true,
  publicSummary: true,
  privateFeatures: true,
  isSensitive: true,
  foundAt: true,
  foundArea: true,
  storageLocation: true,
}).extend({ id: z.uuid() });

export type UpdateItemInput = z.input<typeof UpdateItemSchema>;

export const ItemStatusChangeSchema = z.object({
  id: z.uuid(),
  status: z.enum(["transferred", "disposed"]),
  note: z.string().trim().max(200).nullable(),
});
