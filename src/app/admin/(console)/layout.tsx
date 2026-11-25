import { Suspense } from "react";
import { AdminHeader, AdminHeaderFallback } from "@/components/admin/admin-header";
import { PendingClaimsBadge } from "@/components/admin/pending-claims-badge";
import { SidebarNav, SidebarNavList } from "@/components/admin/sidebar-nav";
import { TabBar, TabBarList } from "@/components/admin/tab-bar";
import { AppIcon } from "@/components/app-icon";
import { Icon } from "@/components/icon";
import ko from "../../../../messages/ko.json";

// 관리자 공통 레이아웃 (docs/03-screens.md §4): left menu, facility name and logout on top,
// bottom tabs below 768px. Session reads stay inside <Suspense> (cacheComponents).
export default function AdminConsoleLayout({ children }: LayoutProps<"/admin">) {
  return (
    <div className="flex flex-1 bg-canvas">
      <aside className="sticky top-0 hidden h-dvh w-[208px] shrink-0 flex-col gap-1 border-r border-line bg-surface px-3 py-4 md:flex">
        <div className="flex items-center gap-2 px-2 pt-1 pb-4">
          <AppIcon size="md" />
          <span className="font-brand text-character text-ink">{ko.admin.brand}</span>
        </div>
        <Suspense fallback={<SidebarNavList pathname={null} claimsBadge={null} />}>
          <SidebarNav
            claimsBadge={
              <Suspense fallback={null}>
                <PendingClaimsBadge />
              </Suspense>
            }
          />
        </Suspense>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col pb-16 md:pb-0">
        <Suspense fallback={<AdminHeaderFallback />}>
          <AdminHeader />
        </Suspense>
        <Suspense fallback={<AdminPageLoading />}>{children}</Suspense>
      </div>

      <Suspense fallback={<TabBarList pathname={null} />}>
        <TabBar />
      </Suspense>
    </div>
  );
}

function AdminPageLoading() {
  return (
    <div role="status" className="flex flex-1 items-center justify-center gap-2 p-6 text-desc text-ink-muted">
      <Icon name="spinner" size={18} className="animate-spin" />
      {ko.admin.loading}
    </div>
  );
}
