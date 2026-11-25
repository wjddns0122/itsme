import { describe, expect, it } from "vitest";
import type { FoundItemExtraction } from "@/lib/validation/ai";
import { clampConfidence, maskPersonalInfo, postProcessExtraction } from "./postprocess";

const base: FoundItemExtraction = {
  category: "sports.goggles",
  subcategory: "스키 고글",
  colors: ["검정", "주황"],
  brand: null,
  material: null,
  features: ["미러 렌즈"],
  confidence: 0.9,
  public_summary: "검은 테 스키 고글",
  private_features: ["끈 안쪽 M.K 이니셜"],
  is_sensitive: false,
};

describe("maskPersonalInfo", () => {
  it("전화번호·이메일·긴 숫자열을 가린다", () => {
    expect(maskPersonalInfo("연락처 010-1234-5678")).toBe("연락처 ***");
    expect(maskPersonalInfo("+82 10 1234 5678로")).toBe("***로");
    expect(maskPersonalInfo("메일 a.b@example.com 적힘")).toBe("메일 *** 적힘");
    expect(maskPersonalInfo("카드 1234 5678 9012 3456")).toBe("카드 ***");
    expect(maskPersonalInfo("학번 20261234")).toBe("학번 ***");
    expect(maskPersonalInfo("033-000-0000")).toBe("***");
  });

  it("짧은 숫자는 그대로 둔다 (보관함 번호, 연도 등)", () => {
    expect(maskPersonalInfo("보관함 A-03, 2026년")).toBe("보관함 A-03, 2026년");
  });
});

describe("postProcessExtraction", () => {
  it("색상은 3개, 특징은 8개까지 자른다", () => {
    const out = postProcessExtraction({
      ...base,
      colors: ["검정", "주황", "흰색", "빨강"],
      features: Array.from({ length: 10 }, (_, i) => `특징${i}`),
      private_features: Array.from({ length: 10 }, (_, i) => `비공개${i}`),
    });
    expect(out.colors).toHaveLength(3);
    expect(out.features).toHaveLength(8);
    expect(out.private_features).toHaveLength(8);
  });

  it("카드·신분증 분류면 민감 물품으로 강제한다", () => {
    expect(postProcessExtraction({ ...base, category: "wallet_card.card" }).is_sensitive).toBe(true);
    expect(postProcessExtraction({ ...base, category: "wallet_card.id" }).is_sensitive).toBe(true);
    expect(postProcessExtraction(base).is_sensitive).toBe(false);
  });

  it("모든 글 필드에서 개인정보를 가린다", () => {
    const out = postProcessExtraction({
      ...base,
      public_summary: "학생증 010-1234-5678",
      private_features: ["카드번호 1234-5678-9012-3456"],
      features: ["a@example.com 적힘"],
    });
    expect(out.public_summary).toBe("학생증 ***");
    expect(out.private_features).toEqual(["카드번호 ***"]);
    expect(out.features).toEqual(["*** 적힘"]);
  });

  it("빈 문자열 특징은 버리고 확신도를 0~1로 맞춘다", () => {
    const out = postProcessExtraction({ ...base, features: ["  ", "무광"], confidence: 1.7 });
    expect(out.features).toEqual(["무광"]);
    expect(out.confidence).toBe(1);
    expect(clampConfidence(Number.NaN)).toBe(0);
  });
});
