import { describe, expect, it } from "vitest";
import { DEFAULT_ITEM_QUERY, itemListHref, parseItemListQuery, periodStart } from "./filters";

describe("parseItemListQuery", () => {
  it("기본값: 전체 탭, 최근 30일, 최신순, 1쪽", () => {
    expect(parseItemListQuery({})).toEqual(DEFAULT_ITEM_QUERY);
  });

  it("모르는 값은 기본값으로", () => {
    expect(parseItemListQuery({ tab: "x", status: "lost", group: "food", period: "2", sort: "abc", page: "-3" })).toEqual(DEFAULT_ITEM_QUERY);
  });

  it("알맞은 값은 그대로", () => {
    expect(parseItemListQuery({ tab: "review", q: " 고글 ", status: "stored", group: "sports", period: "all", sort: "oldest", page: "3" })).toEqual({
      tab: "review", q: "고글", status: "stored", group: "sports", period: "all", sort: "oldest", page: 3,
    });
  });
});

describe("itemListHref", () => {
  it("기본값은 주소에서 뺀다", () => {
    expect(itemListHref(DEFAULT_ITEM_QUERY)).toBe("/admin/items");
  });

  it("필터를 바꾸면 1쪽으로 돌아간다", () => {
    const q = { ...DEFAULT_ITEM_QUERY, page: 4 };
    expect(itemListHref(q, { status: "stored" })).toBe("/admin/items?status=stored");
    expect(itemListHref(q)).toBe("/admin/items?page=4");
    expect(itemListHref(q, { page: 5 })).toBe("/admin/items?page=5");
  });
});

describe("periodStart", () => {
  it("기간의 시작 시각", () => {
    expect(periodStart("7", new Date("2026-11-25T00:00:00Z"))).toBe("2026-11-18T00:00:00.000Z");
    expect(periodStart("all", new Date())).toBeNull();
  });
});
