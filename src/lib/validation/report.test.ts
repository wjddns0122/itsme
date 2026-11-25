import { describe, expect, it } from "vitest";
import { LostReportInputSchema, reportFieldErrors, stepOfError, type LostReportInput } from "./report";

const TODAY = "2026-11-25";

const base: LostReportInput = {
  userCategory: "sports",
  colors: ["검정"],
  brand: null,
  description: "",
  lostFrom: TODAY,
  lostTo: TODAY,
  lostTimeOfDay: null,
  lostArea: null,
  isRental: false,
  contactName: null,
  contactEmail: "a@example.com",
  contactPhone: null,
  secretDetail: null,
  consent: true,
  reportStartedAt: null,
};

describe("reportFieldErrors", () => {
  it("분류나 설명 중 하나만 있으면 통과", () => {
    expect(reportFieldErrors(base, TODAY)).toEqual([]);
    expect(reportFieldErrors({ ...base, userCategory: null, description: "검은 장갑" }, TODAY)).toEqual([]);
  });

  it("분류도 설명도 없으면 what_required", () => {
    expect(reportFieldErrors({ ...base, userCategory: null }, TODAY)).toContain("what_required");
  });

  it("이메일·전화 둘 다 없으면 contact_required", () => {
    expect(reportFieldErrors({ ...base, contactEmail: null }, TODAY)).toContain("contact_required");
  });

  it("형식이 틀린 이메일·전화번호를 잡는다", () => {
    expect(reportFieldErrors({ ...base, contactEmail: "not-mail" }, TODAY)).toContain("email_invalid");
    expect(reportFieldErrors({ ...base, contactPhone: "123" }, TODAY)).toContain("phone_invalid");
  });

  it("동의하지 않으면 consent_required", () => {
    expect(reportFieldErrors({ ...base, consent: false }, TODAY)).toContain("consent_required");
  });

  it("미래 날짜, 순서가 뒤집힌 날짜, 1년보다 오래된 날짜는 date_invalid", () => {
    expect(reportFieldErrors({ ...base, lostTo: "2026-11-26" }, TODAY)).toContain("date_invalid");
    expect(reportFieldErrors({ ...base, lostFrom: "2026-11-25", lostTo: "2026-11-24" }, TODAY)).toContain("date_invalid");
    expect(reportFieldErrors({ ...base, lostFrom: "2025-11-24" }, TODAY)).toContain("date_invalid");
    expect(reportFieldErrors({ ...base, lostFrom: "2026-02-30" }, TODAY)).toContain("date_invalid");
  });
});

describe("LostReportInputSchema", () => {
  it("빈 선택 입력은 null로 바꾼다 (잘 모르겠어요)", () => {
    const parsed = LostReportInputSchema.parse({ ...base, brand: "  ", lostArea: "", secretDetail: "" });
    expect(parsed.brand).toBeNull();
    expect(parsed.lostArea).toBeNull();
    expect(parsed.secretDetail).toBeNull();
  });

  it("모르는 분류·색상·시간대는 거부한다", () => {
    expect(LostReportInputSchema.safeParse({ ...base, userCategory: "casino" }).success).toBe(false);
    expect(LostReportInputSchema.safeParse({ ...base, colors: ["무지개"] }).success).toBe(false);
    expect(LostReportInputSchema.safeParse({ ...base, lostTimeOfDay: "night" }).success).toBe(false);
  });
});

describe("stepOfError", () => {
  it("에러가 난 단계를 알려준다", () => {
    expect(stepOfError("what_required")).toBe(1);
    expect(stepOfError("date_invalid")).toBe(2);
    expect(stepOfError("consent_required")).toBe(3);
  });
});
