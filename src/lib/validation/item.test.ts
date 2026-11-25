import { describe, expect, it } from "vitest";
import { FoundItemFormSchema, splitFeatures } from "./item";

describe("splitFeatures", () => {
  it("줄바꿈이나 쉼표로 나누고 빈 칸은 버린다", () => {
    expect(splitFeatures("왼쪽 렌즈 흠집, 끈 안쪽 M.K 이니셜\n\n  스티커 ")).toEqual(["왼쪽 렌즈 흠집", "끈 안쪽 M.K 이니셜", "스티커"]);
  });

  it("8개까지만", () => {
    expect(splitFeatures(Array.from({ length: 10 }, (_, i) => `f${i}`).join(","))).toHaveLength(8);
  });
});

describe("FoundItemFormSchema", () => {
  const base = {
    category: "sports.goggles",
    subcategory: "스키 고글",
    colors: ["검정"],
    brand: "",
    publicSummary: "검은 테 스키 고글",
    privateFeatures: "",
    isSensitive: false,
    foundAt: "2026-11-25T14:32",
    foundArea: null,
    storageLocation: "보관함 A-03",
    photoPaths: [],
    extraction: null,
    registerStartedAt: null,
  };

  it("빈 선택 입력은 null로", () => {
    const parsed = FoundItemFormSchema.parse(base);
    expect(parsed.brand).toBeNull();
  });

  it("공개 설명이 비면 거부한다", () => {
    expect(FoundItemFormSchema.safeParse({ ...base, publicSummary: "  " }).success).toBe(false);
  });

  it("모르는 분류·색상은 거부한다", () => {
    expect(FoundItemFormSchema.safeParse({ ...base, category: "food.pizza" }).success).toBe(false);
    expect(FoundItemFormSchema.safeParse({ ...base, colors: ["무지개"] }).success).toBe(false);
  });
});
