import { z } from "zod";
import { CATEGORY_GROUPS } from "@/lib/validation/constants";

// A-04 습득물 목록: filters live in the URL so a link or the back button keeps them.

export const ITEM_TABS = ["all", "review", "analyzing"] as const;
export const ITEM_STATUSES = ["stored", "claimed", "returned", "transferred", "disposed"] as const;
export const ITEM_PERIODS = ["7", "30", "90", "all"] as const;
export const ITEM_SORTS = ["latest", "oldest"] as const;
export const ITEMS_PAGE_SIZE = 50;

const GROUPS = CATEGORY_GROUPS.map((g) => g.group) as [string, ...string[]];

const QuerySchema = z.object({
  tab: z.enum(ITEM_TABS).catch("all"),
  q: z.string().trim().max(50).catch(""),
  status: z.enum(ITEM_STATUSES).nullable().catch(null),
  group: z.enum(GROUPS).nullable().catch(null),
  period: z.enum(ITEM_PERIODS).catch("30"),
  sort: z.enum(ITEM_SORTS).catch("latest"),
  page: z.coerce.number().int().min(1).max(10_000).catch(1),
});

export type ItemListQuery = z.infer<typeof QuerySchema>;

export const DEFAULT_ITEM_QUERY: ItemListQuery = { tab: "all", q: "", status: null, group: null, period: "30", sort: "latest", page: 1 };

export function parseItemListQuery(params: Record<string, string | string[] | undefined>): ItemListQuery {
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  return QuerySchema.parse({
    tab: first(params.tab),
    q: first(params.q) ?? "",
    status: first(params.status) ?? null,
    group: first(params.group) ?? null,
    period: first(params.period),
    sort: first(params.sort),
    page: first(params.page),
  });
}

/** URL for a query; defaults are left out so links stay short. Changing a filter resets the page. */
export function itemListHref(query: ItemListQuery, patch: Partial<ItemListQuery> = {}): string {
  const next = { ...query, ...patch, page: patch.page ?? (Object.keys(patch).length > 0 ? 1 : query.page) };
  const params = new URLSearchParams();
  for (const key of Object.keys(DEFAULT_ITEM_QUERY) as (keyof ItemListQuery)[]) {
    const value = next[key];
    if (value !== null && value !== "" && value !== DEFAULT_ITEM_QUERY[key]) params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `/admin/items?${qs}` : "/admin/items";
}

/** Start of the period as an ISO instant, or null for "전체 기간". */
export function periodStart(period: ItemListQuery["period"], now: Date): string | null {
  if (period === "all") return null;
  return new Date(now.getTime() - Number(period) * 86_400_000).toISOString();
}
