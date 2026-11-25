import "server-only";
import { signPhotoUrls } from "@/lib/storage";
import { BUCKETS } from "@/lib/storage-paths";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";
import { categoryGroupLabel } from "@/lib/validation/constants";
import { ITEMS_PAGE_SIZE, periodStart, type ItemListQuery } from "./filters";

type FoundStatus = Database["public"]["Enums"]["found_status"];

export type ItemListRow = {
  id: string;
  category: string;
  summary: string;
  foundAt: string;
  storageLocation: string | null;
  status: FoundStatus;
  thumbUrl: string | null;
  candidates: number;
};

export type ItemListResult =
  | { status: "ok"; rows: ItemListRow[]; total: number; counts: Record<"all" | "review" | "analyzing", number> }
  | { status: "error" };

const OPEN_CANDIDATE = ["suggested", "claimed", "needs_proof"] as const;

/** A-04 습득물 목록 for the signed-in admin's facility (RLS limits the rows). */
export async function listFoundItems(query: ItemListQuery, now: Date): Promise<ItemListResult> {
  const supabase = await createClient();
  const from = (query.page - 1) * ITEMS_PAGE_SIZE;

  const base = () => supabase.from("found_items").select("id, category, public_summary, found_at, storage_location, status, photo_paths", { count: "exact" });
  let rowsQuery = base();
  if (query.tab === "review") rowsQuery = rowsQuery.eq("review_needed", true);
  if (query.tab === "analyzing") rowsQuery = rowsQuery.eq("ai_status", "pending");
  if (query.status) rowsQuery = rowsQuery.eq("status", query.status);
  if (query.group) rowsQuery = rowsQuery.like("category", `${query.group}.%`);
  const since = periodStart(query.period, now);
  if (since) rowsQuery = rowsQuery.gte("found_at", since);

  const [rows, all, review, analyzing] = await Promise.all([
    query.q
      ? searchRows(supabase, query)
      : rowsQuery.order("found_at", { ascending: query.sort === "oldest" }).range(from, from + ITEMS_PAGE_SIZE - 1),
    supabase.from("found_items").select("id", { count: "exact", head: true }),
    supabase.from("found_items").select("id", { count: "exact", head: true }).eq("review_needed", true),
    supabase.from("found_items").select("id", { count: "exact", head: true }).eq("ai_status", "pending"),
  ]);
  if (rows.error || all.error || review.error || analyzing.error) {
    console.error(JSON.stringify({ event: "item_list_failed", code: rows.error?.code ?? all.error?.code ?? "count" }));
    return { status: "error" };
  }

  const data = rows.data ?? [];
  const ids = data.map((r) => r.id);
  const [candidates, thumbs] = await Promise.all([
    ids.length
      ? supabase.from("match_candidates").select("found_item_id").in("found_item_id", ids).in("status", [...OPEN_CANDIDATE])
      : Promise.resolve({ data: [] as { found_item_id: string }[], error: null }),
    signPhotoUrls(supabase, BUCKETS.foundItems, data.flatMap((r) => (r.photo_paths[0] ? [r.photo_paths[0]] : []))),
  ]);
  const candidateCount = new Map<string, number>();
  for (const c of candidates.data ?? []) candidateCount.set(c.found_item_id, (candidateCount.get(c.found_item_id) ?? 0) + 1);

  return {
    status: "ok",
    rows: data.map((r) => ({
      id: r.id,
      category: categoryGroupLabel(r.category),
      summary: r.public_summary,
      foundAt: r.found_at,
      storageLocation: r.storage_location,
      status: r.status,
      thumbUrl: r.photo_paths[0] ? (thumbs.get(r.photo_paths[0]) ?? null) : null,
      candidates: candidateCount.get(r.id) ?? 0,
    })),
    total: query.q ? data.length : (rows.count ?? 0),
    counts: { all: all.count ?? 0, review: review.count ?? 0, analyzing: analyzing.count ?? 0 },
  };
}

/** Keyword search (search_items: substring + trigram similarity), most similar first; filters apply on top. */
async function searchRows(supabase: Awaited<ReturnType<typeof createClient>>, query: ItemListQuery) {
  const result = await supabase.rpc("search_items", { p_query: query.q, p_limit: ITEMS_PAGE_SIZE });
  if (result.error) return { data: null, error: result.error, count: 0 };
  const filtered = result.data.filter(
    (r) =>
      (!query.status || r.status === query.status) &&
      (!query.group || r.category.startsWith(`${query.group}.`)) &&
      (query.tab !== "review" || r.review_needed) &&
      (query.tab !== "analyzing" || r.ai_status === "pending"),
  );
  return { data: filtered, error: null, count: filtered.length };
}
