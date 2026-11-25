// A-02 대시보드
import Image from "next/image";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense, type ReactNode } from "react";
import { InquiryButton } from "@/components/admin/inquiry-dialog";
import { Icon, type IconName } from "@/components/icon";
import { getAdminContext } from "@/lib/auth/admin";
import { formatWait } from "@/lib/claims/wait";
import { formatMonthDay, seoulDate } from "@/lib/dates";
import { loadDashboard, type Dashboard } from "@/lib/dashboard/load";
import { cn } from "@/lib/utils";
import ko from "../../../../messages/ko.json";

const t = ko.admin.home;

export default function AdminDashboardPage() {
  return (
    <main className="flex flex-col gap-5 px-4 pt-6 pb-24 md:px-6 md:pb-8">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-page font-bold tracking-[-0.01em] text-ink">{t.title}</h1>
        <InquiryButton className="h-10" />
      </div>
      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardBody />
      </Suspense>
      {/* Always reachable on phones: fixed above the bottom tabs (docs/03 A-02). */}
      <Link href="/admin/items/new" className="fixed inset-x-4 bottom-20 z-10 flex h-[52px] items-center justify-center gap-1.5 rounded-ui-md bg-brand text-button-lg font-bold text-on-brand shadow-pop md:hidden">
        <Icon name="plus" size={18} />
        {ko.admin.header.newItem}
      </Link>
    </main>
  );
}

async function DashboardBody() {
  await getAdminContext();
  await connection();
  const now = new Date();
  const result = await loadDashboard(now);
  if (result.status === "error") {
    return (
      <section role="alert" className="flex flex-col items-start gap-3">
        <p className="text-body font-bold text-ink">{t.loadError}</p>
        <Link href="/admin" className="flex h-11 items-center rounded-ui-sm border border-line-strong bg-surface px-4 text-button font-bold text-ink">
          {t.retry}
        </Link>
      </section>
    );
  }
  const { data } = result;
  if (data.empty) {
    return (
      <section className="flex flex-col items-center gap-3 rounded-ui-md border border-line bg-surface px-4 py-10 text-center">
        <Image src="/brand/mascot-main.png" alt="" width={170} height={132} className="h-[132px] w-[170px] object-contain" />
        <p className="text-body leading-[1.5] font-bold text-ink">{t.empty}</p>
        <Link href="/admin/items/new" className="flex h-11 items-center rounded-ui-sm bg-brand px-4 text-button font-bold text-on-brand">
          {ko.admin.header.newItem}
        </Link>
      </section>
    );
  }
  return (
    <>
      <Kpis kpi={data.kpi} now={now} />
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <Todos data={data} now={now} />
        <WeekChart week={data.week} />
      </div>
    </>
  );
}

function Kpis({ kpi, now }: { kpi: Dashboard["kpi"]; now: Date }) {
  const k = t.kpi;
  const cards = [
    { label: k.stored, value: String(kpi.stored), sub: k.storedSub.replace("{n}", String(kpi.storedToday)) },
    { label: k.pending, value: String(kpi.pendingClaims), sub: kpi.oldestClaimAt ? k.pendingSub.replace("{wait}", formatWait(kpi.oldestClaimAt, now)) : k.pendingNone },
    { label: k.returned, value: String(kpi.returnedThisMonth), sub: k.returnedSub.replace("{n}", String(kpi.returnedLastMonth)) },
    { label: k.rate, value: kpi.rate === null ? k.rateNone : `${kpi.rate}%`, sub: k.rateSub.replace("{r}", String(kpi.returnedOfThisMonth)).replace("{f}", String(kpi.registeredThisMonth)) },
    { label: k.inquiries, value: String(kpi.inquiriesThisWeek), sub: k.inquiriesSub.replace("{phone}", String(kpi.inquiriesByChannel.phone)).replace("{visit}", String(kpi.inquiriesByChannel.visit)) },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
      {cards.map((c) => (
        <div key={c.label} className="flex min-w-0 flex-col gap-1 rounded-ui-md border border-line bg-surface p-4">
          <span className="text-desc text-ink-muted">{c.label}</span>
          <span className="text-kpi font-bold tracking-[-0.01em] text-ink">{c.value}</span>
          <span className="truncate text-caption font-medium text-ink-muted">{c.sub}</span>
        </div>
      ))}
    </div>
  );
}

function Todos({ data, now }: { data: Dashboard; now: Date }) {
  return (
    <section className="flex flex-1 flex-col overflow-hidden rounded-ui-md border border-line bg-surface">
      <TodoHead title={t.todoClaims} count={data.kpi.pendingClaims} />
      {data.claims.length === 0 ? <p className="px-4 pb-3 text-desc text-ink-muted">{t.todoNone}</p> : null}
      {data.claims.map((c) => (
        <TodoRow
          key={c.id}
          href={`/admin/claims/${c.id}`}
          icon="user-check-todo"
          tone="bg-blush"
          title={t.todoClaim.replace("{category}", c.category)}
          sub={t.todoWait.replace("{name}", c.name ?? t.noName).replace("{wait}", c.claimedAt ? formatWait(c.claimedAt, now) : "—")}
        />
      ))}
      <TodoHead title={t.todoDue} count={data.dueSoon.length} />
      {data.dueSoon.length === 0 ? <p className="px-4 pb-3 text-desc text-ink-muted">{t.todoNone}</p> : null}
      {data.dueSoon.map((i) => (
        <TodoRow
          key={i.id}
          href={`/admin/items/${i.id}`}
          icon="clock"
          tone="bg-warn-bg"
          title={[i.summary, i.storage].filter(Boolean).join(" · ")}
          sub={t.dueOn.replace("{date}", formatMonthDay(seoulDate(i.dueAt)))}
        />
      ))}
    </section>
  );
}

function TodoHead({ title, count }: { title: string; count: number }) {
  return (
    <div className="flex items-center gap-2 px-4 pt-4 pb-2">
      <h2 className="text-section font-bold tracking-[-0.01em] text-ink">{title}</h2>
      <span className="rounded-ui-pill bg-blush px-[7px] py-px text-caption font-bold text-blush-ink">{count}</span>
    </div>
  );
}

function TodoRow({ href, icon, tone, title, sub }: { href: string; icon: IconName; tone: string; title: string; sub: string }) {
  return (
    <Link href={href} className="flex min-h-16 items-center gap-3 border-b border-line px-4 py-2.5 last:border-b-0 hover:bg-canvas">
      <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-[18px]", tone)}>
        <Icon name={icon} size={18} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-body leading-[1.5] font-bold text-ink">{title}</span>
        <span className="truncate text-caption font-medium text-ink-muted">{sub}</span>
      </span>
      <Icon name="chevron-right" size={18} />
    </Link>
  );
}

const CHART_HEIGHT = 140;

/** F8-3 최근 7일 습득·반환 (Figma 20:1589). Plain bars, no chart library. */
function WeekChart({ week }: { week: Dashboard["week"] }) {
  const max = Math.max(1, ...week.flatMap((d) => [d.found, d.returned]));
  const bar = (n: number) => ({ height: `${Math.max(n > 0 ? 3 : 0, Math.round((n / max) * CHART_HEIGHT))}px` });
  return (
    <section className="flex flex-1 flex-col gap-3 rounded-ui-md border border-line bg-surface p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-section font-bold tracking-[-0.01em] text-ink">{t.chart}</h2>
        <div className="flex items-center gap-2.5 text-caption font-medium text-ink-muted">
          <Legend className="bg-brand">{t.found}</Legend>
          <Legend className="bg-ok">{t.returnedLegend}</Legend>
        </div>
      </div>
      <div className="flex items-end justify-between">
        {week.map((d, i) => (
          <div key={d.day} className="flex flex-col items-center gap-1.5">
            <span className="text-caption font-medium text-ink-muted">{d.found}</span>
            <div className="flex items-end gap-[3px]" role="img" aria-label={`${d.day} ${t.found} ${d.found}, ${t.returnedLegend} ${d.returned}`}>
              <span className="w-3 rounded-t-[3px] bg-brand" style={bar(d.found)} />
              <span className="w-3 rounded-t-[3px] bg-ok" style={bar(d.returned)} />
            </div>
            <span className={cn("text-caption font-medium", i === week.length - 1 ? "text-ink" : "text-ink-muted")}>
              {i === week.length - 1 ? t.today : t.dayLabel.replace("{d}", String(Number(d.day.slice(8))))}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

function Legend({ className, children }: { className: string; children: ReactNode }) {
  return (
    <span className="flex items-center gap-1.5">
      <span aria-hidden className={cn("size-2.5 rounded-[2px]", className)} />
      {children}
    </span>
  );
}

function DashboardSkeleton() {
  return (
    <div role="status" className="flex flex-col gap-4">
      <span className="sr-only">{ko.admin.loading}</span>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
        {[0, 1, 2, 3, 4].map((i) => (
          <span key={i} aria-hidden className="h-[104px] animate-pulse rounded-ui-md bg-surface" />
        ))}
      </div>
      <span aria-hidden className="h-64 animate-pulse rounded-ui-md bg-surface" />
    </div>
  );
}
