import Link from "next/link";
import { AppIcon } from "@/components/app-icon";
import { Icon } from "@/components/icon";
import { ADMIN_NEW_ITEM } from "@/lib/admin/routes";
import { getAdminContext } from "@/lib/auth/admin";
import { signOut } from "@/server/actions/auth";
import ko from "../../../messages/ko.json";

/** Facility name, [습득물 등록] and 로그아웃 (Figma "AdminHeader"), plus the mobile "TopBar". */
export async function AdminHeader() {
  const { facility } = await getAdminContext();
  return <AdminHeaderView facilityName={facility.name} />;
}

/** Same layout without the facility name, shown while the session loads. */
export function AdminHeaderFallback() {
  return <AdminHeaderView facilityName={null} />;
}

function AdminHeaderView({ facilityName }: { facilityName: string | null }) {
  return (
    <>
      <header className="hidden items-center justify-between border-b border-line bg-canvas px-6 py-3 md:flex">
        <FacilityName name={facilityName} className="text-section font-bold tracking-[-0.01em] text-ink" />
        <div className="flex items-center gap-4">
          <Link
            href={ADMIN_NEW_ITEM}
            className="flex h-10 items-center gap-1.5 rounded-ui-sm bg-brand pr-4 pl-3 text-button font-bold text-on-brand"
          >
            <Icon name="plus" size={18} />
            {ko.admin.header.newItem}
          </Link>
          <form action={signOut}>
            <button type="submit" className="flex min-h-11 items-center gap-1.5 text-desc text-ink-muted">
              <Icon name="log-out" size={18} />
              {ko.admin.header.logout}
            </button>
          </form>
        </div>
      </header>

      <header className="flex items-center justify-between gap-3 px-4 py-1.5 md:hidden">
        <span className="flex items-center gap-1.5">
          <AppIcon size="sm" />
          <span className="font-brand text-character text-ink">{ko.admin.brand}</span>
        </span>
        <span className="flex min-w-0 items-center gap-1">
          <FacilityName name={facilityName} className="truncate text-caption font-medium text-ink-muted" />
          <form action={signOut}>
            <button type="submit" aria-label={ko.admin.header.logout} className="flex size-11 items-center justify-center">
              <Icon name="log-out" size={18} />
            </button>
          </form>
        </span>
      </header>
    </>
  );
}

function FacilityName({ name, className }: { name: string | null; className: string }) {
  if (name === null) return <span aria-hidden className="h-5 w-40 animate-pulse rounded-ui-sm bg-line" />;
  return <p className={className}>{name}</p>;
}
