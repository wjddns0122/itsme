"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/icon";
import ko from "../../../messages/ko.json";
import { ADMIN_NAV, isNavItemActive } from "./nav";

/** Bottom tabs below 768px (Figma "BottomTabBar", docs/03-screens.md §4 "모바일 폭에서는 하단 탭"). */
export function TabBar() {
  return <TabBarList pathname={usePathname()} />;
}

/** Also the Suspense fallback, like SidebarNavList. */
export function TabBarList({ pathname }: { pathname: string | null }) {
  return (
    <nav
      aria-label={ko.admin.nav.label}
      className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface px-3 pt-1.5 pb-2.5 md:hidden"
    >
      <ul className="flex items-center justify-between">
        {ADMIN_NAV.map((item) => {
          const active = pathname !== null && isNavItemActive(pathname, item);
          return (
            <li key={item.key}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-11 w-[60px] flex-col items-center gap-0.5 text-caption font-medium whitespace-nowrap",
                  active ? "text-brand" : "text-ink-muted",
                )}
              >
                <Icon name={active ? item.tabActiveIcon : item.icon} size={20} />
                {ko.admin.nav[item.key]}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
