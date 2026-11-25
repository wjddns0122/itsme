import "server-only";
import { seoulDate } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import { categoryLabel } from "@/lib/validation/constants";
import { dashboardPeriods, returnRate } from "./periods";

// A-02 대시보드 for the signed-in admin's facility (RLS). docs/01-prd.md F8-1, F8-2, F8-3.

/** Items whose police transfer is due within this many days show up as a to-do (F8-2). */
export const TRANSFER_SOON_DAYS = 3;
const TODO_LIMIT = 5;

export type Dashboard = {
  kpi: {
    stored: number;
    storedToday: number;
    pendingClaims: number;
    oldestClaimAt: string | null;
    returnedThisMonth: number;
    returnedLastMonth: number;
    rate: number | null;
    registeredThisMonth: number;
    returnedOfThisMonth: number;
    inquiriesThisWeek: number;
    inquiriesByChannel: { phone: number; visit: number };
  };
  claims: { id: string; category: string; name: string | null; claimedAt: string | null }[];
  dueSoon: { id: string; summary: string; storage: string | null; dueAt: string }[];
  week: { day: string; found: number; returned: number }[];
  empty: boolean;
};

export async function loadDashboard(now: Date): Promise<{ status: "ok"; data: Dashboard } | { status: "error" }> {
  const supabase = await createClient();
  const p = dashboardPeriods(now);
  const soon = new Date(now.getTime() + TRANSFER_SOON_DAYS * 86_400_000).toISOString();
  const count = { count: "exact" as const, head: true };

  const [stored, storedToday, anyItem, claims, returnedMonth, returnedLastMonth, registeredMonth, returnedOfMonth, inquiries, dueSoon, weekFound, weekReturned] = await Promise.all([
    supabase.from("found_items").select("id", count).in("status", ["stored", "claimed"]),
    supabase.from("found_items").select("id", count).gte("created_at", p.todayStart),
    supabase.from("found_items").select("id", count),
    supabase
      .from("match_candidates")
      .select("id, claimed_at, item:found_items(category), report:lost_reports(contact_name)")
      .eq("status", "claimed")
      .order("claimed_at", { ascending: true }),
    supabase.from("found_items").select("id", count).eq("status", "returned").gte("returned_at", p.monthStart),
    supabase.from("found_items").select("id", count).eq("status", "returned").gte("returned_at", p.lastMonthStart).lt("returned_at", p.monthStart),
    supabase.from("found_items").select("id", count).gte("created_at", p.monthStart),
    supabase.from("found_items").select("id", count).gte("created_at", p.monthStart).eq("status", "returned"),
    supabase.from("inquiries").select("channel").gte("created_at", p.weekStart),
    supabase
      .from("found_items")
      .select("id, public_summary, storage_location, transfer_due_at")
      .in("status", ["stored", "claimed"])
      .lte("transfer_due_at", soon)
      .order("transfer_due_at", { ascending: true })
      .limit(TODO_LIMIT),
    supabase.from("found_items").select("found_at").gte("found_at", `${p.days[0]}T00:00:00+09:00`),
    supabase.from("found_items").select("returned_at").gte("returned_at", `${p.days[0]}T00:00:00+09:00`),
  ]);
  const failed = [stored, storedToday, anyItem, claims, returnedMonth, returnedLastMonth, registeredMonth, returnedOfMonth, inquiries, dueSoon, weekFound, weekReturned].find((r) => r.error);
  if (failed?.error) {
    console.error(JSON.stringify({ event: "dashboard_failed", code: failed.error.code }));
    return { status: "error" };
  }

  const perDay = (dates: (string | null)[]) => {
    const counts = new Map<string, number>();
    for (const d of dates) if (d) counts.set(seoulDate(d), (counts.get(seoulDate(d)) ?? 0) + 1);
    return counts;
  };
  const found = perDay((weekFound.data ?? []).map((r) => r.found_at));
  const returned = perDay((weekReturned.data ?? []).map((r) => r.returned_at));
  const channels = (inquiries.data ?? []).map((i) => i.channel);
  const claimRows = claims.data ?? [];

  return {
    status: "ok",
    data: {
      kpi: {
        stored: stored.count ?? 0,
        storedToday: storedToday.count ?? 0,
        pendingClaims: claimRows.length,
        oldestClaimAt: claimRows[0]?.claimed_at ?? null,
        returnedThisMonth: returnedMonth.count ?? 0,
        returnedLastMonth: returnedLastMonth.count ?? 0,
        rate: returnRate(returnedOfMonth.count ?? 0, registeredMonth.count ?? 0),
        registeredThisMonth: registeredMonth.count ?? 0,
        returnedOfThisMonth: returnedOfMonth.count ?? 0,
        inquiriesThisWeek: channels.length,
        inquiriesByChannel: { phone: channels.filter((c) => c === "phone").length, visit: channels.filter((c) => c === "visit").length },
      },
      claims: claimRows
        .slice(-TODO_LIMIT)
        .reverse()
        .map((c) => ({ id: c.id, category: c.item ? categoryLabel(c.item.category) : "", name: c.report?.contact_name ?? null, claimedAt: c.claimed_at })),
      dueSoon: (dueSoon.data ?? []).flatMap((i) => (i.transfer_due_at ? [{ id: i.id, summary: i.public_summary, storage: i.storage_location, dueAt: i.transfer_due_at }] : [])),
      week: p.days.map((day) => ({ day, found: found.get(day) ?? 0, returned: returned.get(day) ?? 0 })),
      empty: (anyItem.count ?? 0) === 0,
    },
  };
}
