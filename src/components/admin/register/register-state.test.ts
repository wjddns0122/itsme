import { describe, expect, it } from "vitest";
import type { FoundItemExtraction } from "@/lib/validation/ai";
import { applyExtraction, emptyValues, validateRegister, type AiField } from "./register-state";

const extraction: FoundItemExtraction = {
  category: "sports.goggles",
  subcategory: "스키 고글",
  colors: ["검정", "주황"],
  brand: null,
  material: null,
  features: ["미러 렌즈"],
  confidence: 0.9,
  public_summary: "검은 테 스키 고글",
  private_features: ["끈 안쪽 M.K 이니셜", "렌즈 흠집"],
  is_sensitive: false,
};

const base = emptyValues("2026-11-25T14:32", "보관함 A-03");

describe("applyExtraction", () => {
  it("AI 값을 채우고, 값이 있는 칸만 AI가 채운 칸으로 표시한다", () => {
    const { values, aiFilled } = applyExtraction(base, new Set(), extraction);
    expect(values.category).toBe("sports.goggles");
    expect(values.privateFeatures).toBe("끈 안쪽 M.K 이니셜\n렌즈 흠집");
    expect(values.storageLocation).toBe("보관함 A-03");
    expect([...aiFilled].sort()).toEqual(["category", "colors", "privateFeatures", "publicSummary", "subcategory"]);
    expect(aiFilled.has("brand")).toBe(false);
  });

  it("관리자가 먼저 고친 칸은 덮어쓰지 않는다", () => {
    const edited = new Set<AiField>(["publicSummary"]);
    const { values, aiFilled } = applyExtraction({ ...base, publicSummary: "직접 쓴 설명" }, edited, extraction);
    expect(values.publicSummary).toBe("직접 쓴 설명");
    expect(aiFilled.has("publicSummary")).toBe(false);
  });
});

describe("validateRegister", () => {
  it("분류와 공개 설명이 필요하다", () => {
    expect(validateRegister(base)).toEqual({ category: true, publicSummary: true });
    expect(validateRegister({ ...base, category: "other.other", publicSummary: "검은 장갑" })).toEqual({});
  });
});
