import type { FoundItemExtraction } from "@/lib/validation/ai";
import type { CategoryCode, Color } from "@/lib/validation/constants";

/** A-03 form values as the admin edits them. */
export type RegisterValues = {
  category: CategoryCode | "";
  subcategory: string;
  colors: Color[];
  brand: string;
  isSensitive: boolean;
  publicSummary: string;
  privateFeatures: string;
  foundAt: string;
  foundArea: string;
  storageLocation: string;
};

/** Fields the AI can fill; they show the light blue fill until the admin edits them. */
export type AiField = "category" | "subcategory" | "colors" | "brand" | "isSensitive" | "publicSummary" | "privateFeatures";

export function emptyValues(nowLocal: string, storageLocation: string): RegisterValues {
  return {
    category: "",
    subcategory: "",
    colors: [],
    brand: "",
    isSensitive: false,
    publicSummary: "",
    privateFeatures: "",
    foundAt: nowLocal,
    foundArea: "",
    storageLocation,
  };
}

function fromExtraction(e: FoundItemExtraction): Pick<RegisterValues, AiField> {
  return {
    category: e.category,
    subcategory: e.subcategory ?? "",
    colors: e.colors,
    brand: e.brand ?? "",
    isSensitive: e.is_sensitive,
    publicSummary: e.public_summary,
    privateFeatures: e.private_features.join("\n"),
  };
}

const isFilled = (v: RegisterValues[AiField]) => (Array.isArray(v) ? v.length > 0 : typeof v === "string" ? v !== "" : v);

/**
 * Puts the AI answer into the form. Fields the admin already edited (they started typing while
 * waiting) are kept; only fields with a non-empty AI value are marked as AI-filled.
 */
export function applyExtraction(
  values: RegisterValues,
  edited: ReadonlySet<AiField>,
  e: FoundItemExtraction,
): { values: RegisterValues; aiFilled: Set<AiField> } {
  const ai = fromExtraction(e);
  const next = { ...values };
  const aiFilled = new Set<AiField>();
  for (const key of Object.keys(ai) as AiField[]) {
    if (edited.has(key)) continue;
    (next as Record<AiField, unknown>)[key] = ai[key];
    if (isFilled(ai[key])) aiFilled.add(key);
  }
  return { values: next, aiFilled };
}

export type RegisterErrors = { category?: true; publicSummary?: true };

export function validateRegister(v: RegisterValues): RegisterErrors {
  const errors: RegisterErrors = {};
  if (!v.category) errors.category = true;
  if (!v.publicSummary.trim()) errors.publicSummary = true;
  return errors;
}

/** Remembered per facility so the next item starts with the same storage spot (docs/02 §2 규칙). */
export const lastStorageKey = (facilityId: string) => `itsme.lastStorage.${facilityId}`;
