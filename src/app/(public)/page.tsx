// P-01 시설 찾기 (홈)
import Image from "next/image";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { FacilityRow, FacilityRowSkeleton } from "@/components/public/facility-row";
import { FacilitySearchForm } from "@/components/public/facility-search-form";
import { PublicShell } from "@/components/public/public-shell";
import { RecentFacilities } from "@/components/public/recent-facilities";
import {
  facilitySearchHref,
  groupByProvince,
  hasSearch,
  parseFacilitySearch,
  type FacilitySearch,
  type PublicFacility,
} from "@/lib/facilities/public";
import { listedFacilities, searchFacilities } from "@/lib/facilities/search";
import ko from "../../../messages/ko.json";

const t = ko.public.home;
const EMPTY_SEARCH: FacilitySearch = { q: "", type: null };

export default function FacilitySearchPage({ searchParams }: PageProps<"/">) {
  return (
    <PublicShell footer={t.footer}>
      <div className="flex flex-col gap-3.5">
        <h1 className="text-question font-bold tracking-[-0.02em] text-ink">{t.title}</h1>
        <p className="text-desc text-ink-muted">{t.description}</p>

        {/* ?q= and ?type= are request data, so everything that depends on them streams in. */}
        <Suspense fallback={<SearchArea search={EMPTY_SEARCH} body={<ResultsLoading />} />}>
          <SearchFromParams searchParams={searchParams} />
        </Suspense>
      </div>
    </PublicShell>
  );
}

async function SearchFromParams({ searchParams }: Pick<PageProps<"/">, "searchParams">) {
  const search = parseFacilitySearch(await searchParams);
  const body = hasSearch(search) ? <SearchResults search={search} /> : <BeforeSearch />;
  return <SearchArea search={search} body={body} />;
}

function SearchArea({ search, body }: { search: FacilitySearch; body: ReactNode }) {
  return (
    <>
      <FacilitySearchForm search={search} />
      {body}
    </>
  );
}

async function SearchResults({ search }: { search: FacilitySearch }) {
  const result = await searchFacilities(search);
  if (!result.ok) return <LoadError retryHref={facilitySearchHref(search)} />;
  if (result.data.length === 0) return <NoResult />;

  return (
    <section aria-live="polite" className="flex flex-col gap-3.5">
      <p className="text-caption font-bold text-ink-muted">{t.resultCount.replace("{n}", String(result.data.length))}</p>
      <FacilityList facilities={result.data} />
    </section>
  );
}

async function BeforeSearch() {
  const result = await listedFacilities();
  return (
    <>
      <RecentFacilities />
      {result.ok && result.data.length > 0 ? (
        <section className="flex flex-col gap-3.5">
          <h2 className="text-label font-bold text-ink">{t.byRegion}</h2>
          {groupByProvince(result.data).map((group) => (
            <div key={group.province} className="flex flex-col gap-3.5">
              <h3 className="text-caption font-bold text-ink-muted">{group.province}</h3>
              <FacilityList facilities={group.facilities} />
            </div>
          ))}
        </section>
      ) : null}
      {result.ok ? null : <LoadError retryHref="/" />}
    </>
  );
}

function FacilityList({ facilities }: { facilities: readonly PublicFacility[] }) {
  return (
    <ul className="flex flex-col gap-3.5">
      {facilities.map((f) => (
        <li key={f.slug}>
          <FacilityRow facility={f} />
        </li>
      ))}
    </ul>
  );
}

function NoResult() {
  return (
    <section aria-live="polite" className="flex flex-col items-center gap-2.5 pt-2 text-center">
      <Image src="/brand/mascot-curious.png" alt="" width={130} height={99} className="h-[99px] w-[130px] object-contain" />
      <p className="text-body leading-[1.5] font-bold text-ink">{t.noResult}</p>
      <a href={t.lost112Url} target="_blank" rel="noopener noreferrer" className="text-body text-info underline">
        {t.lost112Label}
      </a>
    </section>
  );
}

function LoadError({ retryHref }: { retryHref: string }) {
  return (
    <section role="alert" className="flex flex-col items-center gap-2.5 pt-2 text-center">
      <p className="text-body leading-[1.5] font-bold text-ink">{t.error}</p>
      <Link
        href={retryHref}
        className="flex h-11 items-center rounded-ui-sm border border-line-strong bg-surface px-4 text-button font-bold text-ink"
      >
        {t.retry}
      </Link>
    </section>
  );
}

function ResultsLoading() {
  return (
    <div role="status" className="flex flex-col gap-3.5">
      <span className="sr-only">{t.loading}</span>
      <FacilityRowSkeleton />
      <FacilityRowSkeleton />
      <FacilityRowSkeleton />
    </div>
  );
}
