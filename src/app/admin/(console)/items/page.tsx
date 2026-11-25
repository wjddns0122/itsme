// A-04 습득물 목록·검색
import Image from "next/image";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { ItemFilters } from "@/components/admin/items/item-filters";
import { CountBadge, ItemStatusBadge } from "@/components/admin/status-badge";
import { Icon } from "@/components/icon";
import { getAdminContext } from "@/lib/auth/admin";
import { formatMonthDay } from "@/lib/dates";
import { ITEMS_PAGE_SIZE, ITEM_TABS, itemListHref, parseItemListQuery, type ItemListQuery } from "@/lib/items/filters";
import { listFoundItems, type ItemListRow } from "@/lib/items/list";
import { foundDay } from "@/lib/reports/view";
import { cn } from "@/lib/utils";
import ko from "../../../../../messages/ko.json";

const t = ko.admin.items;

export default function ItemsPage({ searchParams }: PageProps<"/admin/items">) {
  return (
    <main className="flex flex-col gap-5 px-4 pt-6 pb-8 md:px-6">
      <Suspense fallback={<ListSkeleton />}>
        <ItemList searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function ItemList({ searchParams }: Pick<PageProps<"/admin/items">, "searchParams">) {
  await getAdminContext();
  const query = parseItemListQuery(await searchParams);
  await connection();
  const result = await listFoundItems(query, new Date());

  if (result.status === "error") {
    return (
      <section role="alert" className="flex flex-col items-start gap-3">
        <p className="text-body font-bold text-ink">{t.loadError}</p>
        <Link href={itemListHref(query)} className="flex h-11 items-center rounded-ui-sm border border-line-strong bg-surface px-4 text-button font-bold text-ink">
          {t.retry}
        </Link>
      </section>
    );
  }

  return (
    <>
      <div className="flex items-baseline gap-2">
        <h1 className="text-page font-bold tracking-[-0.01em] text-ink">{t.title}</h1>
        <span className="text-desc text-ink-muted">{t.count.replace("{n}", result.counts.all.toLocaleString("ko-KR"))}</span>
      </div>

      <nav aria-label={t.title} className="flex gap-1 border-b border-line">
        {ITEM_TABS.map((tab) => (
          <Link
            key={tab}
            href={itemListHref(query, { tab })}
            aria-current={query.tab === tab ? "page" : undefined}
            className={cn("-mb-px flex items-center gap-1.5 px-3.5 py-2.5 text-body leading-[1.5]", query.tab === tab ? "border-b-2 border-brand font-bold text-ink" : "text-ink-muted")}
          >
            {t.tabs[tab]}
            <span className={cn("rounded-ui-pill px-2 text-caption font-bold", tab === "review" ? "bg-blush text-blush-ink" : "bg-neutral-bg text-neutral-ink")}>
              {result.counts[tab].toLocaleString("ko-KR")}
            </span>
          </Link>
        ))}
      </nav>

      <form role="search" action="/admin/items" className="flex h-12 items-center gap-2.5 rounded-ui-md border-[1.5px] border-line-strong bg-surface px-3.5 focus-within:border-brand">
        <Icon name="search" size={20} />
        <label htmlFor="item-search" className="sr-only">{t.searchLabel}</label>
        <input id="item-search" name="q" type="search" defaultValue={query.q} placeholder={t.searchPlaceholder} className="min-w-0 flex-1 bg-transparent text-body text-ink outline-none placeholder:text-ink-muted" />
        {query.tab !== "all" ? <input type="hidden" name="tab" value={query.tab} /> : null}
      </form>

      <ItemFilters query={query} />

      {result.rows.length === 0 ? <EmptyState searching={query.q !== "" || query.status !== null || query.group !== null} /> : <ItemTable rows={result.rows} />}

      <Pagination query={query} total={result.total} shown={result.rows.length} />
    </>
  );
}

function ItemTable({ rows }: { rows: ItemListRow[] }) {
  const cols = t.columns;
  return (
    <>
      {/* Tablet and up: table */}
      <div className="hidden overflow-hidden rounded-ui-md border border-line bg-surface md:block">
        <table className="w-full table-fixed text-left">
          <thead>
            <tr className="border-b border-line text-caption font-medium text-ink-muted">
              <th className="w-20 px-4 py-2.5">{cols.photo}</th>
              <th className="w-[13%] px-2 py-2.5">{cols.category}</th>
              <th className="px-2 py-2.5">{cols.summary}</th>
              <th className="w-[13%] px-2 py-2.5">{cols.foundAt}</th>
              <th className="w-[13%] px-2 py-2.5">{cols.storage}</th>
              <th className="w-[12%] px-2 py-2.5">{cols.status}</th>
              <th className="w-[10%] px-2 py-2.5">{cols.candidates}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-line last:border-0 hover:bg-canvas">
                <td className="px-4 py-2">
                  <Link href={`/admin/items/${r.id}`} aria-label={r.summary}>
                    <Thumb url={r.thumbUrl} />
                  </Link>
                </td>
                <td className="px-2 py-2 text-body leading-[1.5] font-bold text-ink">{r.category}</td>
                <td className="px-2 py-2 text-body text-ink">
                  <Link href={`/admin/items/${r.id}`} className="line-clamp-2 hover:underline">
                    {r.summary}
                  </Link>
                </td>
                <td className="px-2 py-2 text-desc text-ink-muted">{formatMonthDay(foundDay(r.foundAt))}</td>
                <td className="px-2 py-2 text-desc text-ink">{r.storageLocation ?? "—"}</td>
                <td className="px-2 py-2">
                  <ItemStatusBadge status={r.status} />
                </td>
                <td className="px-2 py-2">{r.candidates > 0 ? <CountBadge label={t.candidates.replace("{n}", String(r.candidates))} /> : null}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Phone: cards */}
      <ul className="flex flex-col gap-2.5 md:hidden">
        {rows.map((r) => (
          <li key={r.id}>
            <Link href={`/admin/items/${r.id}`} className="flex gap-3 rounded-ui-md border border-line bg-surface p-3">
              <Thumb url={r.thumbUrl} />
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="truncate text-body leading-[1.5] font-bold text-ink">{r.summary}</span>
                <span className="text-caption font-medium text-ink-muted">
                  {r.category} · {formatMonthDay(foundDay(r.foundAt))} · {r.storageLocation ?? "—"}
                </span>
                <span className="flex gap-1.5">
                  <ItemStatusBadge status={r.status} />
                  {r.candidates > 0 ? <CountBadge label={t.candidates.replace("{n}", String(r.candidates))} /> : null}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}

function Thumb({ url }: { url: string | null }) {
  if (!url) {
    return (
      <span className="flex size-12 items-center justify-center rounded-ui-sm bg-neutral-bg" aria-label={t.noPhoto} role="img">
        <Icon name="image" size={24} />
      </span>
    );
  }
  return <Image src={url} alt="" width={48} height={48} unoptimized className="size-12 rounded-ui-sm object-cover" />;
}

function EmptyState({ searching }: { searching: boolean }) {
  return (
    <section className="flex flex-col items-center gap-3 rounded-ui-md border border-line bg-surface px-4 py-10 text-center">
      <Image src={searching ? "/brand/mascot-curious.png" : "/brand/mascot-happy.png"} alt="" width={130} height={100} className="h-[100px] w-[130px] object-contain" />
      <p className="text-body leading-[1.5] font-bold text-ink">{searching ? t.noResult : t.empty}</p>
      <Link
        href={searching ? "/admin/reports/new" : "/admin/items/new"}
        className="flex h-11 items-center rounded-ui-sm bg-brand px-4 text-button font-bold text-on-brand"
      >
        {searching ? t.proxyReport : ko.admin.header.newItem}
      </Link>
    </section>
  );
}

function Pagination({ query, total, shown }: { query: ItemListQuery; total: number; shown: number }) {
  if (total === 0) return null;
  const pages = Math.max(1, Math.ceil(total / ITEMS_PAGE_SIZE));
  const from = (query.page - 1) * ITEMS_PAGE_SIZE + 1;
  return (
    <div className="flex items-center justify-between">
      <p className="text-desc text-ink-muted">
        {t.range.replace("{from}", String(from)).replace("{to}", String(from + shown - 1)).replace("{total}", total.toLocaleString("ko-KR"))}
      </p>
      <nav className="flex items-center gap-1" aria-label={t.title}>
        <PageLink query={query} page={query.page - 1} disabled={query.page <= 1} label={t.prev} icon="‹" />
        <span className="flex size-9 items-center justify-center rounded-ui-sm bg-blush text-label font-bold text-blush-ink" aria-current="page">
          {query.page}
        </span>
        <PageLink query={query} page={query.page + 1} disabled={query.page >= pages} label={t.next} icon="›" />
      </nav>
    </div>
  );
}

function PageLink({ query, page, disabled, label, icon }: { query: ItemListQuery; page: number; disabled: boolean; label: string; icon: string }) {
  if (disabled) return <span className="flex size-11 items-center justify-center text-section text-line" aria-hidden>{icon}</span>;
  return (
    <Link href={itemListHref(query, { page })} aria-label={label} className="flex size-11 items-center justify-center text-section text-ink">
      {icon}
    </Link>
  );
}

function ListSkeleton() {
  return (
    <div role="status" className="flex flex-col gap-3">
      <span className="sr-only">{ko.admin.loading}</span>
      <span aria-hidden className="h-8 w-40 animate-pulse rounded-ui-sm bg-line" />
      <span aria-hidden className="h-12 animate-pulse rounded-ui-md bg-line" />
      {[0, 1, 2, 3].map((i) => (
        <span key={i} aria-hidden className="h-16 animate-pulse rounded-ui-md bg-surface" />
      ))}
    </div>
  );
}
