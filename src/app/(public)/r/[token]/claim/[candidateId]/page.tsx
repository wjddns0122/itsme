// P-05 소유권 확인 요청
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Icon } from "@/components/icon";
import { categoryIcon } from "@/components/public/category-icon";
import { ClaimBlocked, ClaimForm } from "@/components/public/claim/claim-form";
import { FacilityLoading } from "@/components/public/facility-states";
import { PublicShell } from "@/components/public/public-shell";
import { formatMonthDay } from "@/lib/dates";
import { getClaimView, type ClaimView } from "@/lib/reports/claim-view";
import ko from "../../../../../../../messages/ko.json";

const t = ko.public.claim;

export const metadata: Metadata = {
  title: t.metaTitle,
  // Lives under the private report link: never indexed, never sent as a referrer.
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function ClaimPage({ params }: PageProps<"/r/[token]/claim/[candidateId]">) {
  return (
    <PublicShell
      topRight={
        <Suspense fallback={null}>
          <FacilityName params={params} />
        </Suspense>
      }
    >
      <Suspense fallback={<FacilityLoading />}>
        <Claim params={params} />
      </Suspense>
    </PublicShell>
  );
}

async function FacilityName({ params }: Pick<PageProps<"/r/[token]/claim/[candidateId]">, "params">) {
  const { token, candidateId } = await params;
  const result = await getClaimView(token, candidateId);
  return result.status === "ok" ? result.view.facilityName : null;
}

async function Claim({ params }: Pick<PageProps<"/r/[token]/claim/[candidateId]">, "params">) {
  const { token, candidateId } = await params;
  const result = await getClaimView(token, candidateId);
  if (result.status !== "ok") {
    return (
      <section role="alert" className="flex flex-col items-center gap-3 pt-20 text-center">
        <p className="text-section font-bold text-ink">{result.status === "not_found" ? ko.public.status.notFound : t.failed}</p>
        <Link href={result.status === "not_found" ? "/" : `/r/${token}/claim/${candidateId}`} className="flex h-11 items-center rounded-ui-sm border border-line-strong bg-surface px-4 text-button font-bold text-ink">
          {result.status === "not_found" ? ko.public.status.searchAgain : ko.public.facility.retry}
        </Link>
      </section>
    );
  }

  const { view } = result;
  if (view.blocked) return <ClaimBlocked token={token} reason={view.blocked} />;

  return (
    <div className="flex flex-col gap-3.5">
      <h1 className="text-section leading-[1.4] font-bold tracking-[-0.01em] text-ink">{t.intro}</h1>
      <CandidateSummary item={view.item} />
      {view.highValue ? (
        <p className="flex items-center gap-2 rounded-ui-sm bg-info-bg px-3.5 py-3 text-label font-bold text-info">
          <Icon name="lock-info" size={16} />
          {t.highValue}
        </p>
      ) : null}
      <ClaimForm token={token} candidateId={candidateId} questions={view.questions} />
    </div>
  );
}

function CandidateSummary({ item }: { item: ClaimView["item"] }) {
  const meta = [item.foundDate ? t.foundOn.replace("{date}", formatMonthDay(item.foundDate)) : null, item.foundArea].filter(Boolean).join(" · ");
  return (
    <div className="flex items-center gap-3 rounded-ui-md border border-line bg-surface px-3.5 py-3">
      <span className="flex size-11 shrink-0 items-center justify-center rounded-ui-sm bg-blush">
        <Icon name={categoryIcon(item.categoryCode)} size={24} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-body leading-[1.5] font-bold text-ink">{item.summary ?? item.category}</span>
        {meta ? <span className="text-caption font-medium text-ink-muted">{meta}</span> : null}
      </span>
    </div>
  );
}

