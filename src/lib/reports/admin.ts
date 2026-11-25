import "server-only";
import { z } from "zod";
import { DEFAULT_MATCH_CONFIG } from "@/lib/matching/config";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";
import { categoryOrGroupLabel } from "@/lib/validation/constants";
import { parseContactSearch } from "@/lib/validation/contact";
import { REPORTS_PAGE_SIZE, reportPeriodStart, type ReportListQuery } from "./filters";
import { groupReports, type ReportGroup } from "./group";

// A-07 분실 신고 목록 and its drawer, for the signed-in admin (RLS limits rows to their facility).
// Contact details are shown here on purpose: admins call people back. Nothing here reaches P-04.

type ReportStatus = Database["public"]["Enums"]["report_status"];
type CandidateStatus = Database["public"]["Enums"]["candidate_status"];
type InquiryChannel = Database["public"]["Enums"]["inquiry_channel"];

export type AdminReportRow = {
  id: string;
  createdAt: string;
  firstLine: string;
  lostFrom: string;
  lostTo: string;
  status: ReportStatus;
  via: "web" | "admin";
  candidates: number;
  inquiries: number;
  contactKey: string | null;
  contactName: string | null;
};

export type AdminReportGroup = ReportGroup<AdminReportRow> & { inquiries: number };

export type AdminReportListResult =
  | { status: "ok"; groups: AdminReportGroup[]; total: number }
  | { status: "invalid_contact" }
  | { status: "error" };

const OPEN_CANDIDATE: CandidateStatus[] = ["suggested", "claimed", "needs_proof", "approved"];

export async function listLostReports(query: ReportListQuery, now: Date): Promise<AdminReportListResult> {
  const supabase = await createClient();
  const from = (query.page - 1) * REPORTS_PAGE_SIZE;

  let rowsQuery = supabase
    .from("lost_reports")
    .select("id, created_at, description, user_category, lost_from, lost_to, status, created_via, contact_key, contact_name", { count: "exact" });
  if (query.contact) {
    const search = parseContactSearch(query.contact);
    if (!search) return { status: "invalid_contact" };
    rowsQuery = search.kind === "suffix" ? rowsQuery.like("contact_key", `%${search.value}`) : rowsQuery.eq("contact_key", search.value);
  }
  if (query.status) rowsQuery = rowsQuery.eq("status", query.status);
  if (query.via) rowsQuery = rowsQuery.eq("created_via", query.via);
  const since = reportPeriodStart(query.period, now);
  if (since) rowsQuery = rowsQuery.gte("created_at", since);

  const { data, count, error } = await rowsQuery.order("created_at", { ascending: query.sort === "oldest" }).range(from, from + REPORTS_PAGE_SIZE - 1);
  if (error) return failed("rows", error.code);

  const ids = data.map((r) => r.id);
  const keys = [...new Set(data.flatMap((r) => (r.contact_key ? [r.contact_key] : [])))];
  const [candidates, inquiries, people] = await Promise.all([
    ids.length ? supabase.from("match_candidates").select("lost_report_id").in("lost_report_id", ids).in("status", OPEN_CANDIDATE) : empty<{ lost_report_id: string }>(),
    keys.length || ids.length
      ? supabase.from("inquiries").select("lost_report_id, contact_key").or(orFilter(ids, keys))
      : empty<{ lost_report_id: string | null; contact_key: string | null }>(),
    keys.length ? supabase.from("lost_reports").select("contact_key, created_at").in("contact_key", keys) : empty<{ contact_key: string | null; created_at: string }>(),
  ]);
  if (candidates.error || inquiries.error || people.error) return failed("counts", candidates.error?.code ?? inquiries.error?.code ?? people.error?.code ?? "");

  const candidateCount = countBy(candidates.data.map((c) => c.lost_report_id));
  const inquiryByReport = countBy(inquiries.data.flatMap((i) => (i.lost_report_id ? [i.lost_report_id] : [])));
  const inquiryByKey = countBy(inquiries.data.flatMap((i) => (i.contact_key ? [i.contact_key] : [])));
  const totals = new Map<string, { count: number; latest: string }>();
  for (const p of people.data) {
    if (!p.contact_key) continue;
    const t = totals.get(p.contact_key) ?? { count: 0, latest: p.created_at };
    totals.set(p.contact_key, { count: t.count + 1, latest: p.created_at > t.latest ? p.created_at : t.latest });
  }

  const rows: AdminReportRow[] = data.map((r) => ({
    id: r.id,
    createdAt: r.created_at,
    firstLine: r.description.split("\n")[0].trim() || (r.user_category ? categoryOrGroupLabel(r.user_category) : ""),
    lostFrom: r.lost_from,
    lostTo: r.lost_to,
    status: r.status,
    via: r.created_via === "admin" ? "admin" : "web",
    candidates: candidateCount.get(r.id) ?? 0,
    inquiries: inquiryByReport.get(r.id) ?? 0,
    contactKey: r.contact_key,
    contactName: r.contact_name,
  }));
  const groups = groupReports(rows, totals).map((g) => ({ ...g, inquiries: g.key ? (inquiryByKey.get(g.key) ?? 0) : g.rows[0].inquiries }));
  return { status: "ok", groups, total: count ?? rows.length };
}

export type AdminReportDetail = {
  id: string;
  status: ReportStatus;
  via: "web" | "admin";
  description: string;
  category: string | null;
  lostFrom: string;
  lostTo: string;
  lostArea: string | null;
  contact: { name: string | null; email: string | null; phone: string | null };
  secretDetail: string | null;
  sameContactReports: number;
  accessPath: string;
  aiFailed: boolean;
  candidates: { id: string; itemId: string; summary: string; storageLocation: string | null; high: boolean; status: CandidateStatus }[];
  inquiries: { createdAt: string; channel: InquiryChannel; note: string | null }[];
};

export async function getAdminReportDetail(id: string): Promise<{ status: "ok"; detail: AdminReportDetail } | { status: "not_found" } | { status: "error" }> {
  if (!z.uuid().safeParse(id).success) return { status: "not_found" };
  const supabase = await createClient();
  const { data: r, error } = await supabase
    .from("lost_reports")
    .select("id, status, created_via, description, user_category, lost_from, lost_to, lost_area, contact_name, contact_email, contact_phone, contact_key, secret_detail, access_token, ai_status")
    .eq("id", id)
    .maybeSingle();
  if (error) return { status: "error" };
  if (!r) return { status: "not_found" };

  const [candidates, inquiries, same] = await Promise.all([
    supabase
      .from("match_candidates")
      .select("id, status, score, item:found_items(id, public_summary, storage_location)")
      .eq("lost_report_id", id)
      .neq("status", "dismissed")
      .order("score", { ascending: false }),
    supabase
      .from("inquiries")
      .select("created_at, channel, note")
      .or(orFilter([id], r.contact_key ? [r.contact_key] : []))
      .order("created_at", { ascending: false }),
    r.contact_key
      ? supabase.from("lost_reports").select("id", { count: "exact", head: true }).eq("contact_key", r.contact_key)
      : Promise.resolve({ count: 1, error: null }),
  ]);
  if (candidates.error || inquiries.error || same.error) return { status: "error" };

  return {
    status: "ok",
    detail: {
      id: r.id,
      status: r.status,
      via: r.created_via === "admin" ? "admin" : "web",
      description: r.description,
      category: r.user_category,
      lostFrom: r.lost_from,
      lostTo: r.lost_to,
      lostArea: r.lost_area,
      contact: { name: r.contact_name, email: r.contact_email, phone: r.contact_phone },
      secretDetail: r.secret_detail,
      sameContactReports: same.count ?? 1,
      accessPath: `/r/${r.access_token}`,
      aiFailed: r.ai_status === "failed",
      candidates: candidates.data.flatMap((c) =>
        c.item
          ? [{ id: c.id, itemId: c.item.id, summary: c.item.public_summary, storageLocation: c.item.storage_location, high: c.score >= DEFAULT_MATCH_CONFIG.notifyThreshold, status: c.status }]
          : [],
      ),
      inquiries: inquiries.data.map((i) => ({ createdAt: i.created_at, channel: i.channel, note: i.note })),
    },
  };
}

/** PostgREST `or` filter for rows tied to these reports or these people. Ids are uuids and keys are normalized digits or emails. */
function orFilter(ids: readonly string[], keys: readonly string[]): string {
  const parts = [];
  if (ids.length) parts.push(`lost_report_id.in.(${ids.join(",")})`);
  if (keys.length) parts.push(`contact_key.in.(${keys.map((k) => `"${k.replace(/"/g, "")}"`).join(",")})`);
  return parts.join(",");
}

function countBy(values: readonly string[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const v of values) map.set(v, (map.get(v) ?? 0) + 1);
  return map;
}

function empty<T>() {
  return Promise.resolve({ data: [] as T[], error: null });
}

function failed(step: string, code: string): AdminReportListResult {
  console.error(JSON.stringify({ event: "report_list_failed", step, code }));
  return { status: "error" };
}
