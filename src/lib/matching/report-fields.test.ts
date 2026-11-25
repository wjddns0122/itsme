import { describe, expect, it } from "vitest";
import { reportMatchFields, resolveReportCategory } from "./report-fields";

const report = { description: "흰색 에어팟 잃어버렸어요", user_category: "electronics.earphones", colors: [] as string[], brand: null };
const normalization = {
  category: "electronics.earphones" as const,
  subcategory: "무선 이어폰",
  colors: ["흰색" as const],
  brand: "Apple",
  material: null,
  features: ["케이스형"],
  confidence: 0.9,
  language: "ko",
};

describe("reportMatchFields", () => {
  it("정규화 결과로 분류·색상·브랜드와 비교용 텍스트를 만든다", () => {
    const fields = reportMatchFields(report, normalization);
    expect(fields).toMatchObject({ category: "electronics.earphones", colors: ["흰색"], brand: "Apple", ai_status: "done" });
    expect(fields.search_text).toContain("브랜드: Apple");
  });

  it("분실자가 고른 색상·브랜드가 모델 결과보다 우선한다", () => {
    const fields = reportMatchFields({ ...report, colors: ["검정"], brand: "삼성" }, normalization);
    expect(fields).toMatchObject({ colors: ["검정"], brand: "삼성" });
  });

  it("정규화가 없으면 원문으로 비교하고 ai_status는 failed", () => {
    expect(reportMatchFields(report, null)).toEqual({ category: "electronics.earphones", search_text: report.description, ai_status: "failed" });
  });
});

describe("resolveReportCategory", () => {
  it("분실자가 고른 세부 분류가 모델의 분류보다 우선한다", () => {
    expect(resolveReportCategory("electronics.phone", "electronics.watch")).toBe("electronics.phone");
  });

  it("대분류를 골랐으면 그 안의 모델 분류를 쓰고, 벗어나면 대분류를 유지한다", () => {
    expect(resolveReportCategory("sports", "sports.goggles")).toBe("sports.goggles");
    expect(resolveReportCategory("sports", "clothing.gloves")).toBe("sports");
  });

  it("고르지 않았으면 모델의 분류를 쓴다", () => {
    expect(resolveReportCategory(null, "key.key")).toBe("key.key");
  });
});
