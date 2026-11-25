import { describe, expect, it } from "vitest";
import { ADMIN_NAV, isNavItemActive } from "./nav";

const item = (key: string) => {
  const found = ADMIN_NAV.find((i) => i.key === key);
  if (!found) throw new Error(key);
  return found;
};

describe("isNavItemActive", () => {
  it("대시보드는 /admin 에서만 켜진다", () => {
    expect(isNavItemActive("/admin", item("dashboard"))).toBe(true);
    expect(isNavItemActive("/admin/items", item("dashboard"))).toBe(false);
  });

  it("다른 메뉴는 하위 경로에서도 켜진다", () => {
    expect(isNavItemActive("/admin/items", item("items"))).toBe(true);
    expect(isNavItemActive("/admin/items/new", item("items"))).toBe(true);
    expect(isNavItemActive("/admin/claims/abc", item("claims"))).toBe(true);
  });

  it("이름이 비슷한 다른 경로에서는 켜지지 않는다", () => {
    expect(isNavItemActive("/admin/itemsx", item("items"))).toBe(false);
    expect(isNavItemActive("/admin/reports", item("items"))).toBe(false);
  });

  it("메뉴는 문서 순서대로 다섯 개다", () => {
    expect(ADMIN_NAV.map((i) => i.key)).toEqual(["dashboard", "items", "claims", "reports", "settings"]);
  });
});
