import type { LostReportNormalization } from "@/lib/validation/ai";
import { categoryGroup } from "@/lib/validation/constants";
import { buildSearchText } from "./search-text";

type ReportInput = { description: string; user_category: string | null; colors: string[]; brand: string | null };

/**
 * Columns saved on a lost report after §4 정규화. What the person picked on P-03 (colors, brand)
 * wins over what the model read from the text. Without a normalization (AI failed or not set up),
 * the raw description is compared as is (§4-3).
 */
export function reportMatchFields(report: ReportInput, n: LostReportNormalization | null) {
  if (!n) {
    return { category: report.user_category, search_text: report.description, ai_status: "failed" as const };
  }
  const colors = report.colors.length > 0 ? report.colors : n.colors;
  const brand = report.brand ?? n.brand;
  const category = resolveReportCategory(report.user_category, n.category);
  return {
    category,
    subcategory: n.subcategory,
    colors,
    brand,
    features: n.features,
    language: n.language,
    ai_confidence: n.confidence,
    search_text: buildSearchText({ category, subcategory: n.subcategory, colors, brand, material: n.material, features: n.features }),
    ai_status: "done" as const,
  };
}

/**
 * P-03 chips are either a full code ("electronics.phone") or a group ("sports"). A full code wins
 * (§4-2 rule 2). For a group, the model's finer code is kept when it falls inside that group;
 * otherwise the group itself is stored, which scoring and the prefilter compare by group.
 */
export function resolveReportCategory(userCategory: string | null, modelCategory: string): string {
  if (!userCategory) return modelCategory;
  if (userCategory.includes(".")) return userCategory;
  return categoryGroup(modelCategory) === userCategory ? modelCategory : userCategory;
}
