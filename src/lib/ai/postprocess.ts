import type { FoundItemExtraction, ItemDescriptor } from "@/lib/validation/ai";
import { isSensitiveCategory } from "@/lib/validation/constants";

// Post-processing after the model answers: docs/05-ai-matching.md §3-3.

export const LIMITS = { colors: 3, features: 8 } as const;

const MASK = "***";
// One digit rule covers phones, cards and ID numbers, so a card number is masked whole.
const PATTERNS = [
  /[A-Z0-9._%+-]+\s*@\s*[A-Z0-9.-]+\.[A-Z]{2,}/gi, // email, also "abc @ gmail.com"
  // 6+ digits (card, phone, student or resident numbers) with up to 3 separators between digits:
  // "010-1234-5678", "010.1234.5678", "010 - 1234 - 5678", "010/1234/5678", "(02)123-4567".
  /\+?\(?\d(?:[\s.\-/()]{0,3}\d){5,}/g,
];

/** Safety net for personal data the model should not have written (names cannot be caught this way). */
export function maskPersonalInfo(text: string): string {
  return PATTERNS.reduce((acc, re) => acc.replace(re, MASK), text);
}

const clean = (list: readonly string[], max: number) =>
  list.map((s) => maskPersonalInfo(s.trim())).filter(Boolean).slice(0, max);

export function clampConfidence(n: number): number {
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0;
}

export function postProcessDescriptor<T extends ItemDescriptor>(d: T): T {
  return {
    ...d,
    subcategory: d.subcategory ? maskPersonalInfo(d.subcategory.trim()) || null : null,
    colors: [...new Set(d.colors)].slice(0, LIMITS.colors),
    brand: d.brand ? maskPersonalInfo(d.brand.trim()) || null : null,
    material: d.material ? maskPersonalInfo(d.material.trim()) || null : null,
    features: clean(d.features, LIMITS.features),
    confidence: clampConfidence(d.confidence),
  };
}

export function postProcessExtraction(raw: FoundItemExtraction): FoundItemExtraction {
  const d = postProcessDescriptor(raw);
  return {
    ...d,
    public_summary: maskPersonalInfo(raw.public_summary.trim()),
    private_features: clean(raw.private_features, LIMITS.features),
    // Cards and IDs are always sensitive, whatever the model said.
    is_sensitive: raw.is_sensitive || isSensitiveCategory(raw.category),
  };
}
