import Link from "next/link";
import { Icon } from "@/components/icon";
import { FACILITY_TYPE_ICON, type PublicFacility } from "@/lib/facilities/public";
import ko from "../../../messages/ko.json";

/** One facility in P-01 lists (Figma "FacilityRow"). Opens the facility page (P-02). */
export function FacilityRow({ facility }: { facility: PublicFacility }) {
  const typeLabel = ko.facilityTypes[facility.type];
  const meta = facility.region ? `${facility.region} · ${typeLabel}` : typeLabel;

  return (
    <Link
      href={`/f/${facility.slug}`}
      className="flex items-center gap-3 rounded-ui-md border border-line bg-surface px-3.5 py-3 transition-colors hover:border-line-strong"
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-ui-sm bg-blush">
        <Icon name={FACILITY_TYPE_ICON[facility.type]} size={22} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-body leading-[1.5] font-bold text-ink">{facility.name}</span>
        <span className="text-caption font-medium text-ink-muted">{meta}</span>
      </span>
      <Icon name="chevron-right" size={18} />
    </Link>
  );
}

export function FacilityRowSkeleton() {
  return (
    <div aria-hidden className="flex items-center gap-3 rounded-ui-md border border-line bg-surface px-3.5 py-3">
      <span className="size-10 shrink-0 animate-pulse rounded-ui-sm bg-blush" />
      <span className="flex flex-1 flex-col gap-1.5">
        <span className="h-4 w-2/3 animate-pulse rounded-ui-sm bg-line" />
        <span className="h-3 w-1/3 animate-pulse rounded-ui-sm bg-line" />
      </span>
    </div>
  );
}
