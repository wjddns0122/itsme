// A-06 소유권 확인 요청 (목록)
import Image from "next/image";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { Icon } from "@/components/icon";
import { getAdminContext } from "@/lib/auth/admin";
import { listClaims, type ClaimListRow } from "@/lib/claims/admin";
import { formatWait, isLongWait } from "@/lib/claims/wait";
import { formatSeoulDateTime } from "@/lib/dates";
import { cn } from "@/lib/utils";
import ko from "../../../../../messages/ko.json";

const t = ko.admin.claims;

export default function ClaimsPage() {
  return (
    <main className="flex flex-col gap-5 px-4 pt-6 pb-8 md:px-6">
      <Suspense fallback={<ListSkeleton />}>
        <ClaimList />
      </Suspense>
    </main>
  );
}

async function ClaimList() {
  await getAdminContext();
  const result = await listClaims();
  await connection();
  const now = new Date();

  if (result.status === "error") {
    return (
      <section role="alert" className="flex flex-col items-start gap-3">
        <p className="text-body font-bold text-ink">{t.loadError}</p>
        <Link href="/admin/claims" className="flex h-11 items-center rounded-ui-sm border border-line-strong bg-surface px-4 text-button font-bold text-ink">
          {t.retry}
        </Link>
      </section>
    );
  }

  return (
    <>
      <div className="flex items-baseline gap-2">
        <h1 className="text-page font-bold tracking-[-0.01em] text-ink">{t.title}</h1>
        <span className="text-desc text-ink-muted">{t.waiting.replace("{n}", String(result.rows.length))}</span>
      </div>
      {result.rows.length === 0 ? (
        <section className="flex flex-col items-center gap-3 rounded-ui-md border border-line bg-surface px-4 py-10 text-center">
          <Image src="/brand/mascot-sleeping.png" alt="" width={160} height={100} className="h-[100px] w-40 object-contain" />
          <p className="text-body leading-[1.5] font-bold text-ink">{t.empty}</p>
        </section>
      ) : (
        <section className="overflow-hidden rounded-ui-md border border-line bg-surface">
          <div className={cn("hidden bg-canvas px-4 py-3 text-caption font-bold text-ink-muted", grid)}>
            <span>{t.columns.claimedAt}</span>
            <span>{t.columns.item}</span>
            <span>{t.columns.reporter}</span>
            <span>{t.columns.wait}</span>
            <span />
          </div>
          <ul>
            {result.rows.map((row) => (
              <li key={row.id} className="border-t border-line first:border-t-0">
                <Row row={row} now={now} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

const grid = "md:grid md:grid-cols-[132px_minmax(0,1fr)_minmax(0,1fr)_96px_24px] md:items-center md:gap-x-3";

function Row({ row, now }: { row: ClaimListRow; now: Date }) {
  return (
    <Link href={`/admin/claims/${row.id}`} className={cn("flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-3 hover:bg-canvas", grid)}>
      <span className="w-full text-desc text-ink md:w-auto">{row.claimedAt ? formatSeoulDateTime(row.claimedAt) : "—"}</span>
      <span className="flex min-w-0 items-center gap-2.5">
        <span className="relative flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-ui-sm bg-neutral-bg">
          {row.thumbUrl ? <Image src={row.thumbUrl} alt="" fill unoptimized className="object-cover" /> : <Icon name="image" size={22} />}
        </span>
        <span className="truncate text-label font-bold text-ink">{row.category}</span>
      </span>
      <span className="text-body text-ink">{row.reporterName ?? "–"}</span>
      <span className={cn("text-label font-bold", row.claimedAt && isLongWait(row.claimedAt, now) ? "text-brand" : "text-ink")}>
        {row.claimedAt ? formatWait(row.claimedAt, now) : "—"}
        {row.status === "needs_proof" ? <span className="ml-1.5 text-caption font-medium text-ink-muted">({ko.candidateStatus.needs_proof})</span> : null}
      </span>
      <span className="ml-auto hidden md:block">
        <Icon name="chevron-right" size={18} />
      </span>
    </Link>
  );
}

function ListSkeleton() {
  return (
    <div role="status" className="flex flex-col gap-3">
      <span className="sr-only">{ko.admin.loading}</span>
      <span aria-hidden className="h-8 w-48 animate-pulse rounded-ui-sm bg-line" />
      {[0, 1, 2, 3].map((i) => (
        <span key={i} aria-hidden className="h-16 animate-pulse rounded-ui-md bg-surface" />
      ))}
    </div>
  );
}
