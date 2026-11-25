import { categoryOrGroupLabel } from "@/lib/validation/constants";

/** Stored rows carry plain strings, so this takes them as they come from the DB or the AI. */
export type SearchTextInput = {
  category: string;
  subcategory: string | null;
  colors: readonly string[];
  brand: string | null;
  material: string | null;
  features: readonly string[];
};

/**
 * Comparison text built by code in one fixed shape for found items and reports alike
 * (docs/05-ai-matching.md §2-4). Used for AI similarity judging and admin keyword search, never
 * shown to people who lost something. Found items pass private_features as `extra`.
 */
export function buildSearchText(d: SearchTextInput, extra: readonly string[] = []): string {
  const features = [...d.features, ...extra].filter(Boolean);
  return [
    `분류: ${categoryOrGroupLabel(d.category)}${d.subcategory ? ` / ${d.subcategory}` : ""}`,
    d.colors.length ? `색상: ${d.colors.join(", ")}` : null,
    d.brand ? `브랜드: ${d.brand}` : null,
    d.material ? `재질: ${d.material}` : null,
    features.length ? `특징: ${features.join(", ")}` : null,
  ]
    .filter((line): line is string => line !== null)
    .join("\n");
}
