import { describe, expect, it } from "vitest";
import { DEFAULT_REPORT_QUERY, parseReportListQuery, reportListHref } from "./filters";

describe("parseReportListQuery", () => {
  it("모르는 값은 기본값으로 둔다", () => {
    expect(parseReportListQuery({ status: "nope", period: "5", page: "-1", open: "x" })).toEqual(DEFAULT_REPORT_QUERY);
  });

  it("주소의 필터를 읽는다", () => {
    const q = parseReportListQuery({ contact: " 5678 ", status: "open", via: "admin", period: "all", sort: "oldest", page: "2" });
    expect(q).toMatchObject({ contact: "5678", status: "open", via: "admin", period: "all", sort: "oldest", page: 2 });
  });
});

describe("reportListHref", () => {
  const open = "0b8f7c3e-2f5a-4c55-9f1e-6d2a3b4c5d6e";

  it("기본값은 주소에서 뺀다", () => {
    expect(reportListHref(DEFAULT_REPORT_QUERY)).toBe("/admin/reports");
  });

  it("필터를 바꾸면 1쪽으로 가고 서랍을 닫는다", () => {
    const q = { ...DEFAULT_REPORT_QUERY, page: 3, open };
    expect(reportListHref(q, { status: "open" })).toBe("/admin/reports?status=open");
  });

  it("서랍만 열면 쪽과 필터를 그대로 둔다", () => {
    const q = { ...DEFAULT_REPORT_QUERY, page: 3, via: "web" as const };
    expect(reportListHref(q, { open })).toBe(`/admin/reports?via=web&page=3&open=${open}`);
  });
});
