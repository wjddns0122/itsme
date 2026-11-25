import type { IconName } from "@/components/icon";

export type AdminNavKey = "dashboard" | "items" | "claims" | "reports" | "settings";

export type AdminNavItem = {
  key: AdminNavKey;
  href: string;
  icon: IconName;
  /** Sidebar active icon (blush-ink). */
  activeIcon: IconName;
  /** Bottom tab active icon. Figma only draws the 습득물 tab in brand red; the others reuse the sidebar icon. */
  tabActiveIcon: IconName;
  /** Match the href exactly instead of as a prefix. */
  exact?: boolean;
};

// Order and routes: docs/03-screens.md §2, §4 (공통 레이아웃).
export const ADMIN_NAV: readonly AdminNavItem[] = [
  { key: "dashboard", href: "/admin", icon: "dashboard", activeIcon: "dashboard-active", tabActiveIcon: "dashboard-active", exact: true },
  { key: "items", href: "/admin/items", icon: "package", activeIcon: "package-active", tabActiveIcon: "package-tab-active" },
  { key: "claims", href: "/admin/claims", icon: "user-check", activeIcon: "user-check-active", tabActiveIcon: "user-check-active" },
  { key: "reports", href: "/admin/reports", icon: "file-text", activeIcon: "file-text-active", tabActiveIcon: "file-text-active" },
  { key: "settings", href: "/admin/settings", icon: "settings", activeIcon: "settings-active", tabActiveIcon: "settings-active" },
];

export function isNavItemActive(pathname: string, item: Pick<AdminNavItem, "href" | "exact">): boolean {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}
