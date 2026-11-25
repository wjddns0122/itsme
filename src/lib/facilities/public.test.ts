import { describe, expect, it } from "vitest";
import { facilitySearchHref, groupByProvince, hasSearch, parseFacilitySearch, toPublicFacility } from "./public";

describe("parseFacilitySearch", () => {
  it("검색어는 앞뒤 공백을 지우고, 종류는 알려진 값만 받는다", () => {
    expect(parseFacilitySearch({ q: "  평창 ", type: "ski_resort" })).toEqual({ q: "평창", type: "ski_resort" });
  });

  it("모르는 종류나 너무 긴 검색어는 필터 없음으로 바꾼다", () => {
    expect(parseFacilitySearch({ type: "casino" })).toEqual({ q: "", type: null });
    expect(parseFacilitySearch({ q: "가".repeat(51) })).toEqual({ q: "", type: null });
  });

  it("같은 이름이 여러 번 오면 첫 값을 쓴다", () => {
    expect(parseFacilitySearch({ q: ["노원", "평창"] }).q).toBe("노원");
  });

  it("검색어나 종류가 있어야 검색으로 본다", () => {
    expect(hasSearch({ q: "", type: null })).toBe(false);
    expect(hasSearch({ q: "", type: "cafe" })).toBe(true);
  });
});

describe("toPublicFacility", () => {
  it("허용 필드만 남긴다 (§9-2)", () => {
    const row = { slug: "a", name: "A", region: null, type: "cafe" as const, is_listed: true, address: "비공개", id: "x" };
    expect(toPublicFacility(row)).toEqual({ slug: "a", name: "A", region: "", type: "cafe" });
  });
});

describe("groupByProvince", () => {
  it("지역 첫 단어로 묶고 처음 나온 순서를 지킨다", () => {
    const f = (slug: string, region: string) => ({ slug, name: slug, region, type: "cafe" as const });
    const groups = groupByProvince([f("a", "강원 평창군"), f("b", "서울 노원구"), f("c", "강원 강릉시")]);
    expect(groups.map((g) => [g.province, g.facilities.map((x) => x.slug)])).toEqual([
      ["강원", ["a", "c"]],
      ["서울", ["b"]],
    ]);
  });
});

describe("facilitySearchHref", () => {
  it("빈 값은 주소에서 뺀다", () => {
    expect(facilitySearchHref({})).toBe("/");
    expect(facilitySearchHref({ q: "평창", type: null })).toBe("/?q=%ED%8F%89%EC%B0%BD");
    expect(facilitySearchHref({ q: "", type: "hotel" })).toBe("/?type=hotel");
  });
});
