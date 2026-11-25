import { describe, expect, it } from "vitest";
import { addRecentFacility, parseRecentFacilities } from "./recent-facilities";

const f = (slug: string) => ({ slug, name: slug.toUpperCase(), region: "강원 평창군", type: "ski_resort" as const });

describe("parseRecentFacilities", () => {
  it("저장된 값이 없거나 깨졌으면 빈 목록", () => {
    expect(parseRecentFacilities(null)).toEqual([]);
    expect(parseRecentFacilities("{not json")).toEqual([]);
    expect(parseRecentFacilities(JSON.stringify([{ slug: "a" }]))).toEqual([]);
    expect(parseRecentFacilities(JSON.stringify([{ ...f("a"), type: "casino" }]))).toEqual([]);
  });

  it("세 곳까지만 읽는다", () => {
    expect(parseRecentFacilities(JSON.stringify([f("a"), f("b"), f("c"), f("d")])).map((x) => x.slug)).toEqual(["a", "b", "c"]);
  });
});

describe("addRecentFacility", () => {
  it("새로 본 시설을 맨 앞에 두고 중복을 없앤다", () => {
    expect(addRecentFacility([f("a"), f("b")], f("b")).map((x) => x.slug)).toEqual(["b", "a"]);
  });

  it("세 곳을 넘으면 가장 오래된 시설을 뺀다", () => {
    expect(addRecentFacility([f("a"), f("b"), f("c")], f("d")).map((x) => x.slug)).toEqual(["d", "a", "b"]);
  });
});
