// A-07 분실 신고 목록·대리 신고
import Image from "next/image";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { InquiryButton } from "@/components/admin/inquiry-dialog";
import { CopyPathButton, ReportFilters, RetryReportAnalysis } from "@/components/admin/reports/report-client";
import { ReportStatusBadge, SameContactBadge, SimilarityBadge, ViaBadge } from "@/components/admin/status-badge";
import { Icon } from "@/components/icon";
import { getAdminContext } from "@/lib/auth/admin";
import { formatMonthDay, formatSeoulDateTime, seoulDate } from "@/lib/dates";
import { getAdminReportDetail, listLostReports, type AdminReportGroup, type AdminReportRow } from "@/lib/reports/admin";
import { REPORTS_PAGE_SIZE, reportListHref, parseReportListQuery, type ReportListQuery } from "@/lib/reports/filters";
import { cn } from "@/lib/utils";
import { categoryOrGroupLabel } from "@/lib/validation/constants";
import { maskContactKey } from "@/lib/validation/contact";
import ko from "../../../../../messages/ko.json";

const t = ko.admin.reports;

export default function ReportsPage({ searchParams }: PageProps<"/admin/reports">) {
  return (
    <main className="flex flex-col gap-5 px-4 pt-6 pb-8 md:px-6">
      <Suspense fallback={<ListSkeleton />}>
        <ReportList searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function ReportList({ searchParams }: Pick<PageProps<"/admin/reports">, "searchParams">) {
  await getAdminContext();
  const query = parseReportListQuery(await searchParams);
  await connection();
  const result = await listLostReports(query, new Date());

  if (result.status === "error") {
    return (
      <section role="alert" className="flex flex-col items-start gap-3">
        <p className="text-body font-bold text-ink">{t.loadError}</p>
        <Link href={reportListHref(query)} className="flex h-11 items-center rounded-ui-sm border border-line-strong bg-surface px-4 text-button font-bold text-ink">
          {t.retry}
        </Link>
      </section>
    );
  }

  const total = result.status === "ok" ? result.total : 0;
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-baseline gap-2">
          <h1 className="text-page font-bold tracking-[-0.01em] text-ink">{t.title}</h1>
          <span className="text-desc text-ink-muted">{t.count.replace("{n}", total.toLocaleString("ko-KR"))}</span>
        </div>
        <Link href="/admin/reports/new" className="flex h-11 items-center rounded-ui-sm bg-brand px-4 text-button font-bold text-on-brand">
          {t.proxyReport}
        </Link>
      </div>

      <form role="search" action="/admin/reports" className="flex flex-col gap-1.5">
        <label htmlFor="report-contact" className="text-label font-bold text-ink">
          {t.contactLabel}
        </label>
        <div className="flex h-12 items-center gap-2.5 rounded-ui-md border-[1.5px] border-line-strong bg-surface px-3.5 focus-within:border-brand">
          <Icon name="search" size={20} />
          <input
            id="report-contact"
            name="contact"
            type="search"
            inputMode="email"
            defaultValue={query.contact}
            placeholder={t.contactPlaceholder}
            aria-invalid={result.status === "invalid_contact" || undefined}
            aria-describedby={result.status === "invalid_contact" ? "report-contact-error" : undefined}
            className="min-w-0 flex-1 bg-transparent text-body text-ink outline-none placeholder:text-ink-muted"
          />
        </div>
        {result.status === "invalid_contact" ? (
          <p id="report-contact-error" role="alert" className="text-label font-bold text-danger">
            {t.contactInvalid}
          </p>
        ) : null}
      </form>

      <ReportFilters query={query} />

      {result.status === "ok" && result.groups.length > 0 ? (
        <ReportTable groups={result.groups} query={query} />
      ) : (
        <EmptyState searching={query.contact !== ""} />
      )}

      {result.status === "ok" ? <Pagination query={query} total={result.total} shown={result.groups.reduce((n, g) => n + g.rows.length, 0)} /> : null}

      {query.open ? (
        <Suspense fallback={null}>
          <ReportDrawer id={query.open} closeHref={reportListHref(query, { open: null })} />
        </Suspense>
      ) : null}
    </>
  );
}

const grid = "md:grid md:grid-cols-[88px_minmax(0,1fr)_108px_104px_48px_52px_48px] md:items-center md:gap-x-3";

function ReportTable({ groups, query }: { groups: AdminReportGroup[]; query: ReportListQuery }) {
  const c = t.columns;
  return (
    <section className="overflow-hidden rounded-ui-md border border-line bg-surface">
      <div className={cn("hidden border-b border-line px-6 py-3 text-caption font-bold text-ink-muted", grid)}>
        <span>{c.createdAt}</span>
        <span>{c.firstLine}</span>
        <span>{c.period}</span>
        <span>{c.status}</span>
        <span>{c.candidates}</span>
        <span>{c.via}</span>
        <span>{c.inquiries}</span>
      </div>
      {groups.map((g) =>
        g.key ? (
          <details key={g.key} open className="group border-b border-line last:border-b-0">
            <summary className="flex min-h-13 cursor-pointer list-none flex-wrap items-center gap-2 bg-canvas px-4 py-3 md:px-6 [&::-webkit-details-marker]:hidden">
              <span className="transition-transform group-open:rotate-90">
                <Icon name="chevron-right" size={16} />
              </span>
              <span className="text-body font-bold text-ink">{[g.name, maskContactKey(g.key)].filter(Boolean).join(" · ")}</span>
              <SameContactBadge count={g.total} />
              <span className="ml-auto flex items-baseline gap-2">
                <span className="text-label font-bold text-ink">{t.inquiryCount.replace("{n}", String(g.inquiries))}</span>
                <span className="text-caption font-medium text-ink-muted">{t.latest.replace("{date}", formatMonthDay(seoulDate(g.latest)))}</span>
              </span>
            </summary>
            {g.rows.map((r) => (
              <Row key={r.id} row={r} query={query} />
            ))}
          </details>
        ) : (
          <div key={g.rows[0].id} className="border-b border-line last:border-b-0">
            <Row row={g.rows[0]} query={query} />
          </div>
        ),
      )}
    </section>
  );
}

function Row({ row: r, query }: { row: AdminReportRow; query: ReportListQuery }) {
  const selected = query.open === r.id;
  const period = r.lostFrom === r.lostTo ? formatMonthDay(r.lostFrom) : `${formatMonthDay(r.lostFrom)} ~ ${formatMonthDay(r.lostTo)}`;
  return (
    <Link
      href={reportListHref(query, { open: r.id })}
      scroll={false}
      aria-current={selected ? "true" : undefined}
      className={cn("flex flex-col gap-1.5 border-t border-line px-4 py-3.5 first:border-t-0 md:px-6", grid, selected ? "bg-blush" : "hover:bg-canvas")}
    >
      <span className="text-desc text-ink">{formatMonthDay(seoulDate(r.createdAt))}</span>
      <span className="truncate text-body text-ink">{r.firstLine || "—"}</span>
      <span className="text-caption font-medium text-ink-muted">{period}</span>
      <span className="flex flex-wrap items-center gap-2 md:contents">
        <span>
          <ReportStatusBadge status={r.status} />
        </span>
        <span className="text-body font-bold text-ink">
          <span className="md:hidden">{t.columns.candidates} </span>
          {r.candidates}
        </span>
        <span>
          <ViaBadge via={r.via} />
        </span>
        <span className="text-body font-bold text-ink">{t.inquiryTimes.replace("{n}", String(r.inquiries))}</span>
      </span>
    </Link>
  );
}

/** Right-hand drawer (Figma A-07 신고 서랍). Server-rendered from ?open=<id>; closing is a link. */
async function ReportDrawer({ id, closeHref }: { id: string; closeHref: string }) {
  const result = await getAdminReportDetail(id);
  const d = t.drawer;
  return (
    <aside aria-label={d.title} className="fixed inset-y-0 right-0 z-30 flex w-full max-w-[400px] flex-col bg-surface shadow-pop">
      <div className="flex items-center justify-between px-5 pt-5 pb-3">
        <h2 className="text-section font-bold text-ink">{d.title}</h2>
        <Link href={closeHref} scroll={false} aria-label={d.close} className="flex size-11 items-center justify-center text-section text-ink-muted">
          ✕
        </Link>
      </div>
      {result.status !== "ok" ? (
        <p role="alert" className="px-5 text-body font-bold text-ink">
          {result.status === "not_found" ? d.notFound : t.loadError}
        </p>
      ) : (
        <DrawerBody detail={result.detail} />
      )}
    </aside>
  );
}

function DrawerBody({ detail: r }: { detail: Extract<Awaited<ReturnType<typeof getAdminReportDetail>>, { status: "ok" }>["detail"] }) {
  const d = t.drawer;
  const period = r.lostFrom === r.lostTo ? formatMonthDay(r.lostFrom) : `${formatMonthDay(r.lostFrom)} ~ ${formatMonthDay(r.lostTo)}`;
  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 pb-4">
        <div className="flex flex-wrap gap-1.5">
          <ReportStatusBadge status={r.status} />
          {r.sameContactReports > 1 ? <SameContactBadge count={r.sameContactReports} /> : null}
          <ViaBadge via={r.via} />
        </div>
        {r.aiFailed ? <RetryReportAnalysis id={r.id} /> : null}
        <DrawerField label={d.content}>{r.description || (r.category ? categoryOrGroupLabel(r.category) : "—")}</DrawerField>
        <div className="grid grid-cols-2 gap-3">
          <DrawerField label={d.period}>{period}</DrawerField>
          <DrawerField label={d.area}>{r.lostArea ?? d.areaUnknown}</DrawerField>
        </div>
        <DrawerField label={d.contact}>{[r.contact.name, r.contact.email, r.contact.phone].filter(Boolean).join(" · ")}</DrawerField>
        {r.secretDetail ? (
          <div className="flex flex-col gap-1 rounded-ui-md bg-butter px-3.5 py-3">
            <span className="text-caption font-bold text-butter-ink">{d.secret}</span>
            <span className="text-body font-bold whitespace-pre-line text-ink">{r.secretDetail}</span>
          </div>
        ) : null}
        <section className="flex flex-col gap-2">
          <h3 className="text-caption font-bold text-ink-muted">{d.candidates.replace("{n}", String(r.candidates.length))}</h3>
          {r.candidates.length === 0 ? (
            <p className="text-desc text-ink-muted">{d.noCandidates}</p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {r.candidates.map((c) => (
                <li key={c.id}>
                  <Link href={`/admin/items/${c.itemId}`} className="flex min-h-11 items-center gap-2 text-body text-ink">
                    <span className="min-w-0 flex-1 truncate">{[c.summary, c.storageLocation].filter(Boolean).join(" · ")}</span>
                    <SimilarityBadge high={c.high} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="flex flex-col gap-2">
          <h3 className="text-caption font-bold text-ink-muted">{d.inquiries}</h3>
          {r.inquiries.length === 0 ? (
            <p className="text-desc text-ink-muted">{d.noInquiries}</p>
          ) : (
            <ol className="flex flex-col gap-2.5">
              {r.inquiries.map((i, n) => (
                <li key={n} className="flex gap-2.5">
                  <span aria-hidden className="mt-1.5 size-2 shrink-0 rounded-ui-pill bg-brand" />
                  <span className="flex flex-col">
                    <span className="text-caption font-medium text-ink-muted">{`${formatSeoulDateTime(i.createdAt)} · ${d.channels[i.channel]}`}</span>
                    {i.note ? <span className="text-body text-ink">{i.note}</span> : null}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
      <div className="grid grid-cols-2 gap-2 border-t border-line px-5 py-4 [&>button]:w-full">
        <InquiryButton reportId={r.id} className="border-0 bg-brand text-on-brand [&_img]:hidden" />
        <CopyPathButton path={r.accessPath} label={d.copyLink} copiedLabel={d.copied} />
      </div>
    </>
  );
}

function DrawerField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-caption font-bold text-ink-muted">{label}</span>
      <span className="text-body whitespace-pre-line text-ink">{children}</span>
    </div>
  );
}

function EmptyState({ searching }: { searching: boolean }) {
  return (
    <section className="flex flex-col items-center gap-3 rounded-ui-md border border-line bg-surface px-4 py-10 text-center">
      {searching ? (
        <Image src="/brand/mascot-curious.png" alt="" width={130} height={100} className="h-[100px] w-[130px] object-contain" />
      ) : (
        <Image src="/brand/mascot-sleeping.png" alt="" width={150} height={94} className="h-[94px] w-[150px] object-contain" />
      )}
      <p className="text-body leading-[1.5] font-bold text-ink">{searching ? t.noResult : t.empty}</p>
      {searching ? (
        <Link href="/admin/reports/new" className="flex h-11 items-center rounded-ui-sm bg-brand px-4 text-button font-bold text-on-brand">
          {t.proxyReport}
        </Link>
      ) : null}
    </section>
  );
}

function Pagination({ query, total, shown }: { query: ReportListQuery; total: number; shown: number }) {
  if (total === 0) return null;
  const pages = Math.max(1, Math.ceil(total / REPORTS_PAGE_SIZE));
  const from = (query.page - 1) * REPORTS_PAGE_SIZE + 1;
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

function PageLink({ query, page, disabled, label, icon }: { query: ReportListQuery; page: number; disabled: boolean; label: string; icon: string }) {
  if (disabled) return <span className="flex size-11 items-center justify-center text-section text-line" aria-hidden>{icon}</span>;
  return (
    <Link href={reportListHref(query, { page })} aria-label={label} className="flex size-11 items-center justify-center text-section text-ink">
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
        <span key={i} aria-hidden className="h-14 animate-pulse rounded-ui-md bg-surface" />
      ))}
    </div>
  );
}
