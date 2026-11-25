import type { IconName } from "@/components/icon";

/** Category icons drawn in Figma so far; other categories use the generic package icon. */
export function categoryIcon(code: string): IconName {
  if (code === "electronics.earphones") return "category-earphones";
  if (code === "electronics.phone") return "category-phone";
  if (code === "sports.goggles") return "category-goggles";
  return "package";
}
