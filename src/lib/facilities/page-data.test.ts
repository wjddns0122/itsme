import { describe, expect, it } from "vitest";
import { deskInfoRows, FacilitySlugSchema, toFacilityPage, type FacilityRow } from "./page-data";

const row: FacilityRow = {
  slug: "pc-ski",
  name: "평창 ○○ 스키장 (예시)",
  region: "강원 평창군",
  type: "ski_resort",
  intro: "  ",
  homepage_url: null,
  contact_phone: "033-000-0000",
  hours: "매일 08:30 ~ 22:00",
  desk_location: "센터하우스 1층",
  pickup_guide: null,
  areas: ["리프트 A", "  ", "렌탈샵"],
};

describe("toFacilityPage", () => {
  it("허용 필드만 옮기고 빈 문자열은 없음으로 바꾼다", () => {
    const withExtra = { ...row, address: "비공개 주소", is_listed: false, id: "x" } as FacilityRow;
    const page = toFacilityPage(withExtra);
    expect(page).not.toHaveProperty("address");
    expect(page).not.toHaveProperty("is_listed");
    expect(page).not.toHaveProperty("id");
    expect(page.intro).toBeNull();
    expect(page.contactPhone).toBe("033-000-0000");
    expect(page.areas).toEqual(["리프트 A", "렌탈샵"]);
  });
});

describe("deskInfoRows", () => {
  it("안내데스크 위치와 연락처를 한 줄에, 운영 시간을 다음 줄에 둔다", () => {
    expect(deskInfoRows({ deskLocation: "센터하우스 1층", contactPhone: "033-000-0000", hours: "매일" })).toEqual([
      { label: "desk", value: "센터하우스 1층 · 033-000-0000" },
      { label: "hours", value: "매일" },
    ]);
  });

  it("위치가 없으면 연락처 줄만 보여 준다", () => {
    expect(deskInfoRows({ deskLocation: null, contactPhone: "033-000-0000", hours: null })).toEqual([
      { label: "contact", value: "033-000-0000" },
    ]);
  });

  it("정보가 하나도 없으면 빈 목록", () => {
    expect(deskInfoRows({ deskLocation: null, contactPhone: null, hours: null })).toEqual([]);
  });
});

describe("FacilitySlugSchema", () => {
  it("소문자·숫자·하이픈만 받는다", () => {
    expect(FacilitySlugSchema.safeParse("pc-ski").success).toBe(true);
    expect(FacilitySlugSchema.safeParse("PC-Ski").success).toBe(false);
    expect(FacilitySlugSchema.safeParse("../admin").success).toBe(false);
    expect(FacilitySlugSchema.safeParse("").success).toBe(false);
  });
});
