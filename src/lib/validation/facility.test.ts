import { describe, expect, it } from "vitest";
import { FacilitySettingsSchema } from "./facility";

const base = {
  name: "평창 ○○ 스키장 (예시)",
  type: "ski_resort",
  region: "평창군",
  address: "",
  contactPhone: "033-000-0000",
  homepageUrl: "",
  intro: null,
  hours: "매일 08:30 ~ 22:00",
  deskLocation: "센터하우스 1층",
  pickupGuide: "신분증을 가져오세요.",
  transferDays: 365,
  areas: ["리프트 A", " 리프트 A ", "렌탈샵"],
  isListed: true,
} as const;

describe("FacilitySettingsSchema", () => {
  it("빈 칸은 null로, 같은 구역은 하나로 정리한다", () => {
    const parsed = FacilitySettingsSchema.parse({ ...base, areas: [...base.areas] });
    expect(parsed.address).toBeNull();
    expect(parsed.homepageUrl).toBeNull();
    expect(parsed.areas).toEqual(["리프트 A", "렌탈샵"]);
  });

  it("시설 이름은 필수, 보관 기한은 1일 이상, 홈페이지는 http(s) 주소만", () => {
    expect(FacilitySettingsSchema.safeParse({ ...base, areas: [], name: " " }).success).toBe(false);
    expect(FacilitySettingsSchema.safeParse({ ...base, areas: [], transferDays: 0 }).success).toBe(false);
    expect(FacilitySettingsSchema.safeParse({ ...base, areas: [], homepageUrl: "javascript:alert(1)" }).success).toBe(false);
    expect(FacilitySettingsSchema.safeParse({ ...base, areas: [], homepageUrl: "https://example.com" }).success).toBe(true);
  });
});
