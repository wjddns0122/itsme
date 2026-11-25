import "server-only";
import { z } from "zod";
import { DEFAULT_MATCH_CONFIG } from "@/lib/matching/config";
import { signPhotoUrls } from "@/lib/storage";
import { BUCKETS } from "@/lib/storage-paths";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";

type FoundItemRow = Database["public"]["Tables"]["found_items"]["Row"];
type CandidateStatus = Database["public"]["Enums"]["candidate_status"];
type ReportStatus = Database["public"]["Enums"]["report_status"];

/** A-05 습득물 상세 for admins. Includes private features: this never reaches the public pages. */
export type ItemDetail = {
  item: FoundItemRow;
  photos: { path: string; url: string | null }[];
  transferDays: number;
  candidates: {
    id: string;
    status: CandidateStatus;
    high: boolean;
    report: { id: string; description: string; createdAt: string; status: ReportStatus } | null;
  }[];
  events: { type: string; createdAt: string; byAdmin: boolean; note: string | null }[];
};

export type ItemDetailResult = { status: "ok"; detail: ItemDetail } | { status: "not_found" } | { status: "error" };

export async function getItemDetail(id: string): Promise<ItemDetailResult> {
  if (!z.uuid().safeParse(id).success) return { status: "not_found" };
  const supabase = await createClient();

  const { data: item, error } = await supabase.from("found_items").select("*").eq("id", id).maybeSingle();
  if (error) return failed("item", error.code);
  if (!item) return { status: "not_found" };

  const [facility, candidates, events, urls] = await Promise.all([
    supabase.from("facilities").select("transfer_days").eq("id", item.facility_id).single(),
    supabase
      .from("match_candidates")
      .select("id, status, score, report:lost_reports(id, description, created_at, status)")
      .eq("found_item_id", id)
      .neq("status", "dismissed")
      .order("score", { ascending: false }),
    supabase.from("item_events").select("type, created_at, actor, payload").eq("found_item_id", id).order("created_at"),
    signPhotoUrls(supabase, BUCKETS.foundItems, item.photo_paths),
  ]);
  if (facility.error || candidates.error || events.error) return failed("related", facility.error?.code ?? candidates.error?.code ?? events.error?.code ?? "");

  return {
    status: "ok",
    detail: {
      item,
      photos: item.photo_paths.map((path) => ({ path, url: urls.get(path) ?? null })),
      transferDays: facility.data.transfer_days,
      candidates: candidates.data.map((c) => ({
        id: c.id,
        status: c.status,
        high: c.score >= DEFAULT_MATCH_CONFIG.notifyThreshold,
        report: c.report ? { id: c.report.id, description: c.report.description, createdAt: c.report.created_at, status: c.report.status } : null,
      })),
      events: events.data.map((e) => ({
        type: e.type,
        createdAt: e.created_at,
        byAdmin: e.actor !== null,
        note: noteOf(e.payload),
      })),
    },
  };
}

function noteOf(payload: unknown): string | null {
  const note = (payload as { note?: unknown } | null)?.note;
  return typeof note === "string" && note ? note : null;
}

function failed(step: string, code: string): ItemDetailResult {
  console.error(JSON.stringify({ event: "item_detail_failed", step, code }));
  return { status: "error" };
}
