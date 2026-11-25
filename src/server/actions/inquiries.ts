"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { getAdminContext } from "@/lib/auth/admin";
import { createClient } from "@/lib/supabase/server";
import { toContactKey } from "@/lib/validation/contact";
import type { ActionResult } from "./result";

// A-10 문의 기록 (FL-026, docs/04-architecture.md §6-5). As the signed-in admin (RLS).

const InquirySchema = z.object({
  channel: z.enum(["phone", "visit", "message", "other"]),
  reportId: z.uuid().nullable(),
  contact: z.string().trim().max(254).nullable(),
  note: z.string().trim().max(200).nullable(),
});
export type InquiryInput = z.input<typeof InquirySchema>;

/**
 * Saves who asked, how and about what. With a report it is linked directly; with only a contact the
 * latest report of that person (same contact_key) is linked when there is one, otherwise the inquiry
 * waits under the contact and joins that person's group when they report later.
 */
export async function logInquiry(input: InquiryInput): Promise<ActionResult<{ linkedPath: string | null; matched: boolean }>> {
  const parsed = InquirySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_input" };
  const { channel, reportId, contact, note } = parsed.data;
  const contactKey = contact ? toContactKey({ phone: contact, email: contact.includes("@") ? contact : null }) : null;
  if (!reportId && !contactKey) return { ok: false, error: "invalid_input" };

  const { userId, facility } = await getAdminContext();
  const supabase = await createClient();
  let report: { id: string; contact_key: string | null; access_token: string } | null = null;
  if (reportId) {
    const { data } = await supabase.from("lost_reports").select("id, contact_key, access_token").eq("id", reportId).maybeSingle();
    if (!data) return { ok: false, error: "not_found" };
    report = data;
  } else if (contactKey) {
    const { data } = await supabase
      .from("lost_reports")
      .select("id, contact_key, access_token")
      .eq("contact_key", contactKey)
      .in("status", ["open", "claimed"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    report = data;
  }

  const { error } = await supabase.from("inquiries").insert({
    facility_id: facility.id,
    lost_report_id: report?.id ?? null,
    channel,
    contact_key: report?.contact_key ?? contactKey,
    note: note || null,
    handled_by: userId,
  });
  if (error) {
    console.error(JSON.stringify({ event: "log_inquiry_failed", code: error.code }));
    return { ok: false, error: "internal" };
  }
  if (report) {
    await supabase.from("item_events").insert({ facility_id: facility.id, lost_report_id: report.id, actor: userId, type: "inquiry_logged", payload: { channel } });
  }
  refresh();
  return { ok: true, data: { linkedPath: report ? `/r/${report.access_token}` : null, matched: report !== null } };
}
