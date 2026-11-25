import { describe, expect, it } from "vitest";
import { addDays, addDaysToInstant, formatMonthDay, isIsoDate, seoulLocalToIso, seoulNowLocalInput, seoulToday } from "./dates";

describe("seoulToday", () => {
  it("한국 시간 기준 날짜를 준다 (UTC 15시 = 서울 다음 날 0시)", () => {
    expect(seoulToday(new Date("2026-11-24T14:59:00Z"))).toBe("2026-11-24");
    expect(seoulToday(new Date("2026-11-24T15:00:00Z"))).toBe("2026-11-25");
  });
});

describe("addDays", () => {
  it("월과 해를 넘긴다", () => {
    expect(addDays("2026-11-30", 1)).toBe("2026-12-01");
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
  });
});

describe("isIsoDate", () => {
  it("실제로 있는 날짜만 받는다", () => {
    expect(isIsoDate("2026-11-25")).toBe(true);
    expect(isIsoDate("2026-02-30")).toBe(false);
    expect(isIsoDate("2026-1-5")).toBe(false);
  });
});

describe("formatMonthDay", () => {
  it("월 일로 보여준다", () => {
    expect(formatMonthDay("2026-11-04")).toBe("11월 4일");
  });
});

describe("seoul datetime-local", () => {
  it("지금 시각을 서울 기준 입력값으로", () => {
    expect(seoulNowLocalInput(new Date("2026-11-25T05:32:10Z"))).toBe("2026-11-25T14:32");
  });

  it("입력값을 서울 시각으로 읽어 ISO로 바꾼다", () => {
    expect(seoulLocalToIso("2026-11-25T14:32")).toBe("2026-11-25T05:32:00.000Z");
    expect(seoulLocalToIso("2026-11-25 14:32")).toBeNull();
  });

  it("며칠 뒤 시각", () => {
    expect(addDaysToInstant("2026-11-25T05:32:00.000Z", 30)).toBe("2026-12-25T05:32:00.000Z");
  });
});
