import { describe, expect, it } from "vitest";
import { LostReportInputSchema } from "@/lib/validation/report";
import { activeDatePreset, datePresetRange, draftToInput, emptyDraft, type ReportDraft } from "./draft";

const TODAY = "2026-11-25";

describe("draftToInput", () => {
  it("잘 모르겠어요는 null이나 빈 목록으로 보낸다", () => {
    const d: ReportDraft = { ...emptyDraft(TODAY), colors: ["검정"], colorsUnknown: true, brandKnown: false, brand: "오클리", area: "리프트 A", areaUnknown: true, timeOfDay: "unknown" };
    const input = draftToInput(d, null);
    expect(input.colors).toEqual([]);
    expect(input.brand).toBeNull();
    expect(input.lostArea).toBeNull();
    expect(input.lostTimeOfDay).toBeNull();
  });

  it("빈 입력칸은 null, 채운 칸은 앞뒤 공백을 지운다", () => {
    const input = draftToInput({ ...emptyDraft(TODAY), email: " a@example.com ", phone: "", brandKnown: true, brand: " 오클리 " }, null);
    expect(input.contactEmail).toBe("a@example.com");
    expect(input.contactPhone).toBeNull();
    expect(input.brand).toBe("오클리");
  });

  it("서버 스키마를 그대로 통과한다", () => {
    const input = draftToInput({ ...emptyDraft(TODAY), userCategory: "sports", colors: ["검정" as const], email: "a@example.com", consent: true }, "2026-11-25T01:00:00.000Z");
    expect(LostReportInputSchema.safeParse(input).success).toBe(true);
  });
});

describe("date presets", () => {
  it("오늘·어제·최근 3일 범위를 만든다", () => {
    expect(datePresetRange("today", TODAY)).toEqual({ lostFrom: TODAY, lostTo: TODAY });
    expect(datePresetRange("yesterday", TODAY)).toEqual({ lostFrom: "2026-11-24", lostTo: "2026-11-24" });
    expect(datePresetRange("last3Days", TODAY)).toEqual({ lostFrom: "2026-11-23", lostTo: TODAY });
  });

  it("지금 날짜가 어느 빠른 선택과 같은지 알려준다", () => {
    expect(activeDatePreset({ lostFrom: "2026-11-24", lostTo: "2026-11-24" }, TODAY)).toBe("yesterday");
    expect(activeDatePreset({ lostFrom: "2026-11-20", lostTo: "2026-11-21" }, TODAY)).toBeNull();
  });
});
