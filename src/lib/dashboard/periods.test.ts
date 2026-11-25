import { describe, expect, it } from "vitest";
import { dashboardPeriods, returnRate } from "./periods";

describe("dashboardPeriods", () => {
  it("한국 시간 기준으로 오늘·이번 달·지난달·이번 주(월요일)를 정한다", () => {
    // 2026-11-25 (수) 23:30 KST = 14:30 UTC
    const p = dashboardPeriods(new Date("2026-11-25T14:30:00Z"));
    expect(p.todayStart).toBe("2026-11-24T15:00:00.000Z");
    expect(p.monthStart).toBe("2026-10-31T15:00:00.000Z");
    expect(p.lastMonthStart).toBe("2026-09-30T15:00:00.000Z");
    expect(p.weekStart).toBe("2026-11-22T15:00:00.000Z");
    expect(p.days).toEqual(["2026-11-19", "2026-11-20", "2026-11-21", "2026-11-22", "2026-11-23", "2026-11-24", "2026-11-25"]);
  });

  it("1월이면 지난달은 작년 12월", () => {
    expect(dashboardPeriods(new Date("2027-01-10T03:00:00Z")).lastMonthStart).toBe("2026-11-30T15:00:00.000Z");
  });
});

describe("returnRate", () => {
  it("반올림한 백분율, 등록이 없으면 null", () => {
    expect(returnRate(37, 90)).toBe(41);
    expect(returnRate(0, 0)).toBeNull();
  });
});
