// P-04 신고 현황·후보
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { Icon } from "@/components/icon";
import { categoryIcon } from "@/components/public/category-icon";
import { ProofForm } from "@/components/public/claim/claim-form";
import { FacilityLoading } from "@/components/public/facility-states";
import { PublicShell } from "@/components/public/public-shell";
import { AutoRefresh, CancelReport, CandidateActions, CopyLinkButton } from "@/components/public/status/report-actions";
import { formatMonthDay } from "@/lib/dates";
import { getReportView } from "@/lib/reports/get-view";
import { reportPhase, showInfoLow, type PublicCandidate, type ReportView } from "@/lib/reports/view";
import { cn } from "@/lib/utils";
import { REPORT_CATEGORY_CHIPS } from "@/lib/validation/report";
import ko from "../../../../../messages/ko.json";

const t = ko.public.status;
const REFRESH_WHILE_ANALYZING_MS = 5_000;

export const metadata: Metadata = {
  title: t.metaTitle,
  // A private link: never indexed, never sent as a referrer.
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function ReportStatusPage({ params, searchParams }: PageProps<"/r/[token]">) {
  return (
    <PublicShell
      topRight={
        <Suspense fallback={null}>
          <FacilityName params={params} />
        </Suspense>
      }
    >
      <Suspense fallback={<FacilityLoading />}>
        <ReportStatus params={params} searchParams={searchParams} />
      </Suspense>
    </PublicShell>
  );
}

async function FacilityName({ params }: Pick<PageProps<"/r/[token]">, "params">) {
  const { token } = await params;
  const result = await getReportView(token);
  return result.status === "ok" ? result.view.facility.name : null;
}

async function ReportStatus({ params, searchParams }: Pick<PageProps<"/r/[token]">, "params" | "searchParams">) {
  const [{ token }, query] = await Promise.all([params, searchParams]);
  const result = await getReportView(token);
  if (result.status === "not_found") return <Message text={t.notFound} actionLabel={t.searchAgain} actionHref="/" />;
  if (result.status === "error") return <Message text={t.actionFailed} actionLabel={ko.public.facility.retry} actionHref={`/r/${token}`} />;

  const { view } = result;
  const phase = reportPhase(view);
  const isNew = query.new === "1";

  return (
    <div className="flex flex-col gap-3.5">
      {isNew ? <NewReportBanner rental={view.report.isRental} /> : null}
      <ReportSummary view={view} />
      {view.notConfirmed ? <p role="status" className="rounded-ui-sm bg-neutral-bg px-3.5 py-3 text-desc text-neutral-ink">{t.notConfirmed}</p> : null}

      {phase === "analyzing" ? (
        <>
          <AutoRefresh everyMs={REFRESH_WHILE_ANALYZING_MS} />
          <StateNote image={MASCOT.magnifier} text={t.analyzing} live />
        </>
      ) : null}
      {phase === "empty" ? <StateNote image={MASCOT.sleeping} text={t.empty} sub={t.emptySub} /> : null}
      {phase === "closed" ? <StateNote image="/brand/mascot-curious.png" text={t.cancelled} /> : null}
      {phase === "approved" ? <Approved view={view} /> : null}
      {phase === "claimed" || phase === "needs_proof" ? <ClaimInProgress view={view} phase={phase} token={token} /> : null}
      {phase === "candidates" ? <CandidateList view={view} token={token} /> : null}

      {phase !== "closed" && phase !== "approved" ? (
        <div className="flex justify-center pt-4">
          <CancelReport token={token} />
        </div>
      ) : null}
    </div>
  );
}

function NewReportBanner({ rental }: { rental: boolean }) {
  return (
    <section className="flex flex-col gap-2 rounded-ui-md border-[1.5px] border-brand bg-surface p-3.5" aria-live="polite">
      <div className="flex items-center justify-between gap-3">
        <p className="text-body leading-[1.5] font-bold text-ink">{t.newBanner}</p>
        <CopyLinkButton />
      </div>
      <p className="text-desc text-ink-muted">{t.newBannerSub}</p>
      {rental ? <p className="text-desc font-bold text-blush-ink">{t.rentalNotice}</p> : null}
    </section>
  );
}

function dateRange(from: string, to: string): string {
  return from === to ? formatMonthDay(from) : `${formatMonthDay(from)} ~ ${formatMonthDay(to)}`;
}

function ReportSummary({ view }: { view: ReportView }) {
  const { report } = view;
  const chipLabel = REPORT_CATEGORY_CHIPS.find((c) => c.value === report.userCategory)?.label;
  const title = report.description.split("\n")[0] || chipLabel || "";
  const meta = [dateRange(report.lostFrom, report.lostTo), report.lostArea].filter(Boolean).join(" · ");

  return (
    <section className="flex flex-col gap-1 rounded-ui-md border border-line bg-surface px-3.5 py-3">
      <div className="flex items-center gap-2">
        <p className="min-w-0 flex-1 truncate text-body leading-[1.5] font-bold text-ink">{title}</p>
        <span className="shrink-0 rounded-ui-pill bg-blush px-[9px] py-0.5 text-caption font-bold text-blush-ink">
          {/* Figma 32:218: while the facility waits for proof the badge says so. */}
          {view.candidates.some((c) => c.status === "needs_proof") ? ko.candidateStatus.needs_proof : t.reportStatus[report.status]}
        </span>
      </div>
      <p className="text-caption font-medium text-ink-muted">{meta}</p>
    </section>
  );
}

type Mascot = { src: string; width: number; height: number };

/** Poses and sizes from Figma P-04 (4:250 찾는 중, 4:268 후보 없음); other states keep the 130×100 slot. */
const MASCOT = {
  magnifier: { src: "/brand/mascot-magnifier.png", width: 170, height: 121 },
  sleeping: { src: "/brand/mascot-sleeping.png", width: 170, height: 107 },
} satisfies Record<string, Mascot>;

function StateNote({ image, text, sub, live }: { image: string | Mascot; text: string; sub?: string; live?: boolean }) {
  const m = typeof image === "string" ? { src: image, width: 130, height: 100 } : image;
  return (
    <section role={live ? "status" : undefined} className="flex flex-col items-center gap-2 pt-3.5 text-center">
      <Image src={m.src} alt="" width={m.width} height={m.height} style={{ width: m.width, height: m.height }} className="object-contain" />
      <p className="text-body leading-[1.5] font-bold text-ink">{text}</p>
      {sub ? <p className="text-desc text-ink-muted">{sub}</p> : null}
    </section>
  );
}

function CandidateList({ view, token }: { view: ReportView; token: string }) {
  return (
    <section className="flex flex-col gap-3.5">
      <div className="flex items-end justify-between">
        <h1 className="text-section font-bold tracking-[-0.01em] text-ink">{t.candidates.replace("{n}", String(view.candidates.length))}</h1>
        <Image src="/brand/mascot-happy.png" alt="" width={86} height={64} className="h-16 w-[86px] object-contain" />
      </div>
      {showInfoLow(view) ? (
        <div className="flex flex-col gap-2 rounded-ui-sm bg-neutral-bg px-3 py-2.5">
          <p className="text-desc text-neutral-ink">{t.infoLow}</p>
          {view.report.status === "open" ? (
            <Link href={`/r/${token}/edit`} className="flex min-h-11 items-center self-start text-label font-bold text-brand underline">
              {t.improve}
            </Link>
          ) : null}
        </div>
      ) : null}
      <ul className="flex flex-col gap-3.5">
        {view.candidates.map((c) => (
          <li key={c.id}>
            <CandidateCard candidate={c}>
              <CandidateActions token={token} candidateId={c.id} />
            </CandidateCard>
          </li>
        ))}
      </ul>
    </section>
  );
}


function CandidateCard({ candidate, children }: { candidate: PublicCandidate; children?: ReactNode }) {
  const { item } = candidate;
  const meta = [item.foundDate ? t.foundOn.replace("{date}", formatMonthDay(item.foundDate)) : null, item.foundArea].filter(Boolean).join(" · ");
  return (
    <article className="flex flex-col gap-2.5 rounded-ui-md border border-line bg-surface p-3.5">
      <div className="flex items-start gap-3">
        {item.photoUrl ? (
          // ADR-030: the first photo of a non-sensitive item, through a short-lived signed URL.
          <span className="relative size-16 shrink-0 overflow-hidden rounded-ui-sm bg-blush">
            <Image src={item.photoUrl} alt={t.photoAlt.replace("{item}", item.summary ?? item.category)} fill unoptimized className="object-cover" />
          </span>
        ) : (
          <span className="flex size-11 shrink-0 items-center justify-center rounded-ui-sm bg-blush">
            <Icon name={categoryIcon(item.categoryCode)} size={24} />
          </span>
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <p className="text-body leading-[1.5] font-bold text-ink">{item.summary ?? item.category}</p>
          {meta ? <p className="text-caption font-medium text-ink-muted">{meta}</p> : null}
        </div>
      </div>
      <span
        className={cn(
          "self-start rounded-ui-pill px-[9px] py-0.5 text-caption font-bold",
          candidate.similarity === "high" ? "bg-butter text-butter-ink" : "bg-neutral-bg text-neutral-ink",
        )}
      >
        {t.similarity[candidate.similarity]}
      </span>
      {children}
    </article>
  );
}

function ClaimInProgress({ view, phase, token }: { view: ReportView; phase: "claimed" | "needs_proof"; token: string }) {
  const active = view.candidates.find((c) => c.status === phase);
  if (phase === "claimed") {
    return (
      <section className="flex flex-col gap-3.5">
        {active ? <CandidateCard candidate={active} /> : null}
        <StateNote image="/brand/mascot-laptop.png" text={t.claimPending} />
      </section>
    );
  }
  return (
    <section className="flex flex-col gap-3.5">
      <div className="flex items-end gap-2">
        <h2 className="min-w-0 flex-1 text-question leading-[1.3] font-bold tracking-[-0.02em] text-ink">{t.needsProof}</h2>
        <Image src="/brand/mascot-curious.png" alt="" width={80} height={61} className="h-[61px] w-20 object-contain" />
      </div>
      {active?.proofRequest ? (
        <div className="flex flex-col gap-1 rounded-ui-sm bg-butter px-3.5 py-3">
          <p className="text-caption font-bold text-butter-ink">{t.proofRequestLabel}</p>
          <p className="text-body leading-[1.5] font-bold whitespace-pre-line text-ink">{active.proofRequest}</p>
        </div>
      ) : null}
      {active ? <ProofForm token={token} candidateId={active.id} /> : null}
    </section>
  );
}

function Approved({ view }: { view: ReportView }) {
  const approved = view.candidates.find((c) => c.status === "approved");
  const { facility } = view;
  const rows = [
    { label: t.pickupPlace, value: facility.deskLocation },
    { label: t.pickupHours, value: facility.hours },
    { label: t.pickupBring, value: facility.pickupGuide },
    { label: t.pickupContact, value: facility.contactPhone },
    { label: t.pickupNote, value: approved?.pickupMessage ?? null },
  ].filter((r): r is { label: string; value: string } => Boolean(r.value));

  return (
    <section className="flex flex-col gap-3.5">
      <div className="flex flex-col items-center gap-1.5 pt-2">
        <p className="rounded-[16px] border-[1.5px] border-line-strong bg-surface px-3.5 py-1.5 font-brand text-character text-ink">{t.approved}</p>
        <Image src="/brand/mascot-found.png" alt="" width={170} height={124} className="h-[124px] w-[170px] object-contain" />
      </div>
      <div className="flex flex-col gap-2 rounded-ui-md border-[1.5px] border-brand bg-surface p-3.5">
        <h1 className="text-section font-bold tracking-[-0.01em] text-ink">{t.pickupTitle}</h1>
        <dl className="flex flex-col gap-2">
          {rows.map((r) => (
            <div key={r.label} className="flex items-start gap-2.5">
              <dt className="w-16 shrink-0 text-caption font-medium text-ink-muted">{r.label}</dt>
              <dd className="min-w-0 flex-1 text-label font-bold text-ink">{r.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

function Message({ text, actionLabel, actionHref }: { text: string; actionLabel: string; actionHref: string }) {
  return (
    <section role="alert" className="flex flex-col items-center gap-3 pt-20 text-center">
      <Image src="/brand/mascot-curious.png" alt="" width={150} height={114} className="h-[114px] w-[150px] object-contain" />
      <p className="text-section font-bold tracking-[-0.01em] text-ink">{text}</p>
      <Link href={actionHref} className="flex h-11 items-center rounded-ui-sm bg-brand px-4 text-button font-bold text-on-brand">
        {actionLabel}
      </Link>
    </section>
  );
}
