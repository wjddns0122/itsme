"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { FilterSelect } from "@/components/admin/items/item-filters";
import { Icon } from "@/components/icon";
import { REPORT_PERIODS, REPORT_SORTS, REPORT_STATUSES, REPORT_VIAS, reportListHref, type ReportListQuery } from "@/lib/reports/filters";
import { cn } from "@/lib/utils";
import { retryReportAnalysis } from "@/server/actions/reports";
import ko from "../../../../messages/ko.json";

const t = ko.admin.reports;

/** 상태 · 접수 경로 · 기간 · 정렬 (Figma A-07). Each change rewrites the URL. */
export function ReportFilters({ query }: { query: ReportListQuery }) {
  const router = useRouter();
  const go = (patch: Partial<ReportListQuery>) => router.push(reportListHref(query, patch));

  return (
    <div className="flex flex-wrap items-center gap-2">
      <FilterSelect label={t.filterStatus} value={query.status ?? ""} onChange={(v) => go({ status: (v || null) as ReportListQuery["status"] })}>
        <option value="">{t.all}</option>
        {REPORT_STATUSES.map((s) => (
          <option key={s} value={s}>
            {ko.reportStatus[s]}
          </option>
        ))}
      </FilterSelect>
      <FilterSelect label={t.filterVia} value={query.via ?? ""} onChange={(v) => go({ via: (v || null) as ReportListQuery["via"] })}>
        <option value="">{t.all}</option>
        {REPORT_VIAS.map((v) => (
          <option key={v} value={v}>
            {t.viaFilter[v]}
          </option>
        ))}
      </FilterSelect>
      <FilterSelect label={t.filterPeriod} value={query.period} onChange={(v) => go({ period: v as ReportListQuery["period"] })}>
        {REPORT_PERIODS.map((p) => (
          <option key={p} value={p}>
            {t.periods[p]}
          </option>
        ))}
      </FilterSelect>
      <span className="flex-1" />
      <FilterSelect label={t.sort} value={query.sort} onChange={(v) => go({ sort: v as ReportListQuery["sort"] })}>
        {REPORT_SORTS.map((s) => (
          <option key={s} value={s}>
            {t.sorts[s]}
          </option>
        ))}
      </FilterSelect>
    </div>
  );
}

/** Copies an absolute link to a path on this site, e.g. the 신고 링크 /r/{token}. */
export function CopyPathButton({ path, label, copiedLabel, primary }: { path: string; label: string; copiedLabel: string; primary?: boolean }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(new URL(path, window.location.origin).toString());
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };
  return (
    <button
      type="button"
      onClick={copy}
      className={cn(
        "flex h-11 shrink-0 items-center justify-center rounded-ui-sm px-4 text-button font-bold",
        primary ? "bg-brand text-on-brand" : "border border-line-strong bg-surface text-ink",
      )}
    >
      {copied ? copiedLabel : label}
    </button>
  );
}

/** Normalization failed (FL-032): [다시 분석] in the drawer. */
export function RetryReportAnalysis({ id }: { id: string }) {
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();
  const run = () =>
    startTransition(async () => {
      const result = await retryReportAnalysis({ id });
      setFailed(!result.ok);
    });
  return (
    <div role="status" className="flex flex-wrap items-center gap-2 rounded-ui-sm bg-warn-bg px-3 py-2.5">
      <Icon name="alert-circle" size={16} />
      <p className="min-w-0 flex-1 text-desc text-ink">{failed ? t.drawer.retryFailed : t.drawer.aiFailed}</p>
      <button type="button" disabled={pending} onClick={run} className="flex h-11 items-center gap-1.5 rounded-ui-sm border border-line-strong bg-surface px-3 text-button font-bold text-ink disabled:opacity-85">
        {pending ? <Icon name="spinner" size={16} className="animate-spin" /> : null}
        {t.drawer.retry}
      </button>
    </div>
  );
}
