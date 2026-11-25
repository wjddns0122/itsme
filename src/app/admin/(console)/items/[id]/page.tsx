// A-05 습득물 상세
import Link from "next/link";
import { Suspense } from "react";
import { ItemInfoCard, ItemStatusActions, PhotoViewer, RetryAnalysis } from "@/components/admin/items/item-detail-client";
import type { RegisterValues } from "@/components/admin/register/register-state";
import { CandidateStatusBadge, CountBadge, ItemStatusBadge, SimilarityBadge } from "@/components/admin/status-badge";
import { getAdminContext } from "@/lib/auth/admin";
import { formatMonthDay, formatSeoulDateTime, formatSeoulFullDate, seoulNowLocalInput } from "@/lib/dates";
import { getItemDetail, type ItemDetail } from "@/lib/items/detail";
import { foundDay } from "@/lib/reports/view";
import { createClient } from "@/lib/supabase/server";
import { categoryGroupLabel, type CategoryCode, type Color } from "@/lib/validation/constants";
import ko from "../../../../../../messages/ko.json";

const t = ko.admin.item;

export default function ItemDetailPage({ params }: PageProps<"/admin/items/[id]">) {
  return (
    <main className="flex flex-col gap-5 px-4 pt-6 pb-8 md:px-6">
      <Link href="/admin/items" className="flex min-h-11 items-center gap-1 self-start text-desc text-ink-muted">
        <span aria-hidden>‹</span> {t.back}
      </Link>
      <Suspense fallback={<span role="status" className="text-desc text-ink-muted">{ko.admin.loading}</span>}>
        <Detail params={params} />
      </Suspense>
    </main>
  );
}

async function Detail({ params }: Pick<PageProps<"/admin/items/[id]">, "params">) {
  const { facility } = await getAdminContext();
  const { id } = await params;
  const result = await getItemDetail(id);
  if (result.status !== "ok") {
    return <p role="alert" className="text-body font-bold text-ink">{result.status === "not_found" ? t.notFound : t.failed}</p>;
  }

  const supabase = await createClient();
  const { data: fac } = await supabase.from("facilities").select("areas").eq("id", facility.id).single();
  const { detail } = result;
  const { item } = detail;
  const open = item.status === "stored" || item.status === "claimed";

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <h1 className="text-page font-bold tracking-[-0.01em] text-ink">{item.public_summary}</h1>
          <ItemStatusBadge status={item.status} />
        </div>
        {open ? <ItemStatusActions id={item.id} /> : null}
      </div>

      {item.ai_status === "failed" && !item.is_sensitive && item.photo_paths.length > 0 ? <RetryAnalysis id={item.id} /> : null}

      <div className="flex flex-col gap-5 md:flex-row md:items-start">
        <div className="md:w-[280px] md:shrink-0">
          <PhotoViewer photos={detail.photos} />
        </div>
        <div className="min-w-0 flex-1">
          <ItemInfoCard id={item.id} rows={infoRows(detail)} values={formValues(detail)} areas={fac?.areas ?? []} />
        </div>
      </div>

      <section className="flex flex-col rounded-ui-md border border-line bg-surface">
        <div className="flex items-center gap-2 px-4 pt-4 pb-2">
          <h2 className="text-section font-bold tracking-[-0.01em] text-ink">{t.candidates}</h2>
          {detail.candidates.length > 0 ? <CountBadge label={ko.admin.items.candidates.replace("{n}", String(detail.candidates.length))} /> : null}
        </div>
        {detail.candidates.length === 0 ? (
          <p className="px-4 pb-4 text-desc text-ink-muted">{t.noCandidates}</p>
        ) : (
          <ul>
            {detail.candidates.map((c) => (
              <li key={c.id} className="flex flex-col gap-1 border-t border-line px-4 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-body text-ink">{c.report?.description.split("\n")[0] || "—"}</span>
                  <SimilarityBadge high={c.high} />
                  {c.report ? <span className="text-caption font-medium text-ink-muted">{formatMonthDay(foundDay(c.report.createdAt))}</span> : null}
                  <CandidateStatusBadge status={c.status} />
                </div>
                <CandidateReasons candidate={c} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3 rounded-ui-md border border-line bg-surface p-4">
        <h2 className="text-section font-bold tracking-[-0.01em] text-ink">{t.history}</h2>
        <ol className="flex flex-col gap-3">
          {detail.events.map((e, i) => (
            <li key={i} className="flex gap-2.5">
              <span aria-hidden className="mt-1.5 size-2 shrink-0 rounded-ui-pill bg-brand" />
              <span className="flex flex-col">
                <span className="text-caption font-medium text-ink-muted">{formatSeoulDateTime(e.createdAt)}</span>
                <span className="text-body text-ink">
                  {(t.events as Record<string, string>)[e.type] ?? e.type}
                  {e.byAdmin ? ` · ${t.byAdmin}` : ""}
                  {e.note ? ` · ${e.note}` : ""}
                </span>
              </span>
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}

/** Why the two look alike (admin only): matched and conflicting features, look-alikes, little information. */
function CandidateReasons({ candidate: c }: { candidate: ItemDetail["candidates"][number] }) {
  const r = t.reasons;
  const notes = [c.tie ? r.tie : null, c.infoLow ? r.infoLow : null, c.judged ? null : r.unjudged].filter(Boolean).join(" · ");
  if (c.matched.length === 0 && c.conflicts.length === 0 && !notes) return null;
  return (
    <p className="text-caption font-medium text-ink-muted">
      {c.matched.length > 0 ? `${r.matched}: ${c.matched.join(", ")}` : null}
      {c.matched.length > 0 && c.conflicts.length > 0 ? " · " : null}
      {c.conflicts.length > 0 ? <span className="text-danger">{`${r.conflicts}: ${c.conflicts.join(", ")}`}</span> : null}
      {notes ? `${c.matched.length + c.conflicts.length > 0 ? " · " : ""}${notes}` : null}
    </p>
  );
}

function infoRows({ item, transferDays }: ItemDetail) {
  const r = t.rows;
  const found = [formatSeoulDateTime(item.found_at), item.found_area].filter(Boolean).join(" · ");
  const rows = [
    { label: r.category, value: [categoryGroupLabel(item.category), item.subcategory].filter(Boolean).join(" · ") },
    { label: r.color, value: item.colors.join(", ") || t.none },
    { label: r.brand, value: item.brand ? `${item.brand}${item.ai_status === "done" ? ` ${t.guessed}` : ""}` : t.none },
    { label: r.summary, value: item.public_summary },
    { label: r.private, value: item.private_features.join("\n") || t.none, highlight: item.private_features.length > 0 },
    { label: r.found, value: found },
    { label: r.storage, value: item.storage_location ?? t.none },
  ];
  if (item.transfer_due_at) {
    rows.push({ label: r.due, value: t.dueValue.replace("{date}", formatSeoulFullDate(item.transfer_due_at)).replace("{days}", String(transferDays)) });
  }
  return rows;
}

function formValues({ item }: ItemDetail): RegisterValues {
  return {
    category: item.category as CategoryCode,
    subcategory: item.subcategory ?? "",
    colors: item.colors as Color[],
    brand: item.brand ?? "",
    isSensitive: item.is_sensitive,
    publicSummary: item.public_summary,
    privateFeatures: item.private_features.join("\n"),
    foundAt: seoulNowLocalInput(new Date(item.found_at)),
    foundArea: item.found_area ?? "",
    storageLocation: item.storage_location ?? "",
  };
}
