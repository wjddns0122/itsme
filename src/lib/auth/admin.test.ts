import { describe, expect, it } from "vitest";
import { firstFacilityByName } from "./admin";

const f = (name: string) => ({ id: name, name, slug: name });

describe("firstFacilityByName", () => {
  it("시설이 여러 곳이면 이름순으로 첫 시설을 고른다", () => {
    expect(firstFacilityByName([f("평창 스키장"), f("강릉 리조트"), f("성수 카페")])?.name).toBe("강릉 리조트");
  });

  it("연결된 시설이 없으면 null", () => {
    expect(firstFacilityByName([])).toBeNull();
    expect(firstFacilityByName([null])).toBeNull();
  });
});
