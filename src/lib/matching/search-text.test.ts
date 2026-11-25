import { describe, expect, it } from "vitest";
import { buildSearchText } from "./search-text";

describe("buildSearchText", () => {
  it("문서의 형식 그대로 줄을 만든다", () => {
    const text = buildSearchText(
      { category: "electronics.earphones", subcategory: "무선 이어폰", colors: ["검정"], brand: "애플", material: null, features: ["케이스형"] },
      ["은색 별 키링"],
    );
    expect(text).toBe("분류: 이어폰·헤드폰 / 무선 이어폰\n색상: 검정\n브랜드: 애플\n특징: 케이스형, 은색 별 키링");
  });

  it("모르는 값은 줄째 뺀다", () => {
    expect(buildSearchText({ category: "other.other", subcategory: null, colors: [], brand: null, material: null, features: [] })).toBe("분류: 기타");
  });
});
