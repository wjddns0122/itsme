import { z } from "zod";
import { periodStart as itemPeriodStart } from "@/lib/items/filters";

// A-07 분실 신고 목록: filters live in the URL, like A-04. `open` is the report shown in the drawer.

export const REPORT_STATUSES = ["open", "claimed", "resolved", "closed"] as const;
export const REPORT_VIAS = ["web", "admin"] as const;
export const REPORT_PERIODS = ["7", "30", "90", "all"] as const;
export const REPORT_SORTS = ["latest", "oldest"] as const;
export const REPORTS_PAGE_SIZE = 50;

const QuerySchema = z.object({
  contact: z.string().trim().max(254).catch(""),
  status: z.enum(REPORT_STATUSES).nullable().catch(null),
  via: z.enum(REPORT_VIAS).nullable().catch(null),
  period: z.enum(REPORT_PERIODS).catch("30"),
  sort: z.enum(REPORT_SORTS).catch("latest"),
  page: z.coerce.number().int().min(1).max(10_000).catch(1),
  open: z.uuid().nullable().catch(null),
});

export type ReportListQuery = z.infer<typeof QuerySchema>;

export const DEFAULT_REPORT_QUERY: ReportListQuery = { contact: "", status: null, via: null, period: "30", sort: "latest", page: 1, open: null };

export function parseReportListQuery(params: Record<string, string | string[] | undefined>): ReportListQuery {
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  return QuerySchema.parse({
    contact: first(params.contact) ?? "",
    status: first(params.status) ?? null,
    via: first(params.via) ?? null,
    period: first(params.period),
    sort: first(params.sort),
    page: first(params.page),
    open: first(params.open) ?? null,
  });
}

/** URL for a query; defaults are left out. Changing a filter resets the page and closes the drawer. */
export function reportListHref(query: ReportListQuery, patch: Partial<ReportListQuery> = {}): string {
  const keys = Object.keys(patch);
  const onlyDrawer = keys.length > 0 && keys.every((k) => k === "open");
  const next = {
    ...query,
    ...(keys.length > 0 && !onlyDrawer ? { page: 1, open: null } : {}),
    ...patch,
  };
  const params = new URLSearchParams();
  for (const key of Object.keys(DEFAULT_REPORT_QUERY) as (keyof ReportListQuery)[]) {
    const value = next[key];
    if (value !== null && value !== "" && value !== DEFAULT_REPORT_QUERY[key]) params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `/admin/reports?${qs}` : "/admin/reports";
}

export const reportPeriodStart = (period: ReportListQuery["period"], now: Date) => itemPeriodStart(period, now);
