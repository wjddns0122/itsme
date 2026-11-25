"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/icon";
import ko from "../../../messages/ko.json";
import { ADMIN_NAV, isNavItemActive } from "./nav";

/** Left menu items (Figma "Sidebar"). `claimsBadge` is the pending-claims count, rendered on the server. */
export function SidebarNav({ claimsBadge }: { claimsBadge: ReactNode }) {
  return <SidebarNavList pathname={usePathname()} claimsBadge={claimsBadge} />;
}

/** Also the Suspense fallback: on routes with a request-time param (/admin/items/[id]) the path is unknown while prerendering. */
export function SidebarNavList({ pathname, claimsBadge }: { pathname: string | null; claimsBadge: ReactNode }) {
  return (
    <nav aria-label={ko.admin.nav.label}>
      <ul className="flex flex-col gap-1">
        {ADMIN_NAV.map((item) => {
          const active = pathname !== null && isNavItemActive(pathname, item);
          return (
            <li key={item.key}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-11 items-center gap-2.5 rounded-ui-sm px-3 py-2.5 text-body leading-[1.5] font-bold transition-colors",
                  active ? "bg-blush text-blush-ink" : "text-ink hover:bg-canvas",
                )}
              >
                <Icon name={active ? item.activeIcon : item.icon} size={20} />
                <span className="flex-1">{ko.admin.nav[item.key]}</span>
                {item.key === "claims" ? claimsBadge : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
