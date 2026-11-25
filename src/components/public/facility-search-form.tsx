import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/icon";
import { FACILITY_TYPE_CHIPS, facilitySearchHref, type FacilitySearch } from "@/lib/facilities/public";
import ko from "../../../messages/ko.json";

const t = ko.public.home;

/**
 * Search box and type chips (Figma "SearchBar" and "Chip"). A plain GET form, so it works
 * before JavaScript loads; the URL (?q=&type=) is the state.
 */
export function FacilitySearchForm({ search }: { search: FacilitySearch }) {
  return (
    <>
      <form role="search" action="/" className="relative pt-[58px]">
        <label htmlFor="facility-search" className="sr-only">
          {t.searchLabel}
        </label>
        <div className="flex h-12 items-center gap-2.5 rounded-ui-md border-[1.5px] border-line-strong bg-surface px-3.5 focus-within:border-brand focus-within:ring-3 focus-within:ring-brand/20">
          <Icon name="search" size={20} />
          <input
            id="facility-search"
            name="q"
            type="search"
            defaultValue={search.q}
            placeholder={t.placeholder}
            enterKeyHint="search"
            maxLength={50}
            autoComplete="off"
            className="min-w-0 flex-1 bg-transparent text-body text-ink outline-none placeholder:text-ink-muted"
          />
        </div>
        {search.type ? <input type="hidden" name="type" value={search.type} /> : null}
        {/* After the box so the mascot's paws sit on its border, as in Figma. */}
        <Image
          src="/brand/mascot-peek.png"
          alt=""
          width={150}
          height={65}
          priority
          className="pointer-events-none absolute top-0 right-3 h-[65px] w-[150px] object-contain"
        />
      </form>

      <nav aria-label={t.typeFilterLabel}>
        <ul className="flex flex-wrap gap-1.5">
          <TypeChip label={t.all} href={facilitySearchHref({ q: search.q })} selected={search.type === null} />
          {FACILITY_TYPE_CHIPS.map((type) => (
            <TypeChip
              key={type}
              label={ko.facilityTypes[type]}
              href={facilitySearchHref({ q: search.q, type })}
              selected={search.type === type}
            />
          ))}
        </ul>
      </nav>
    </>
  );
}

function TypeChip({ label, href, selected }: { label: string; href: string; selected: boolean }) {
  return (
    <li>
      <Link
        href={href}
        aria-current={selected ? "true" : undefined}
        className={cn(
          "flex h-9 items-center rounded-ui-pill border px-3 text-label font-bold whitespace-nowrap",
          selected ? "border-brand bg-blush text-blush-ink" : "border-line bg-surface text-ink",
        )}
      >
        {label}
      </Link>
    </li>
  );
}
