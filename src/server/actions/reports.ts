"use server";

import { randomBytes } from "node:crypto";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { z } from "zod";
import { getAdminContext } from "@/lib/auth/admin";
import { seoulToday } from "@/lib/dates";
import { FacilitySlugSchema } from "@/lib/facilities/page-data";
import { processReport } from "@/lib/matching/process";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { normalizeEmail, toContactKey } from "@/lib/validation/contact";
import { LostReportInputSchema, reportFieldErrors, type ReportFieldError } from "@/lib/validation/report";
import type { ActionResult, ErrorCode } from "./result";

/** null before the first submit. Success redirects to the report page, so only failures come back. */
export type CreateReportState = { ok: false; error: ErrorCode; fields?: ReportFieldError[] } | null;

/** Two identical submits within this window return the first report (double taps, slow networks). */
const DUPLICATE_WINDOW_MS = 60_000;

/**
 * P-03 분실 신고 (docs/04-architecture.md §6-2). Not signed in, so it runs with the service role and
 * limits itself to the facility named by `slug`. Contact data is never logged or sent to the LLM.
 * Normalization and matching run after the response (FL-022, FL-031).
 */
export async function createLostReport(slug: string, _prev: CreateReportState, formData: FormData): Promise<CreateReportState> {
  // Honeypot: people never see this field; bots fill it.
  if (formData.get("website")) return { ok: false, error: "invalid_input" };

  const parsed = LostReportInputSchema.safeParse(parsePayload(formData.get("payload")));
  if (!parsed.success || !FacilitySlugSchema.safeParse(slug).success) return { ok: false, error: "invalid_input" };
  const input = parsed.data;

  const fields = reportFieldErrors(input, seoulToday());
  if (fields.length > 0) return { ok: false, error: "invalid_input", fields };

  const supabase = createAdminClient();
  const { data: facility, error: facilityError } = await supabase
    .from("facilities")
    .select("id, areas")
    .eq("slug", slug)
    .maybeSingle();
  if (facilityError) return failed("facility_lookup", facilityError.code);
  if (!facility) return { ok: false, error: "not_found" };

  const contactKey = toContactKey({ phone: input.contactPhone, email: input.contactEmail });
  const existing = await findRecentDuplicate(supabase, facility.id, contactKey, input.description, input.userCategory);
  if (existing) redirect(`/r/${existing}?new=1`);

  const accessToken = randomBytes(24).toString("base64url");
  const { data: report, error: insertError } = await supabase
    .from("lost_reports")
    .insert({
      facility_id: facility.id,
      description: input.description,
      user_category: input.userCategory,
      colors: input.colors,
      brand: input.brand,
      lost_from: input.lostFrom,
      lost_to: input.lostTo,
      lost_time_of_day: input.lostTimeOfDay,
      // Only areas the facility actually has; anything else counts as "잘 모르겠어요".
      lost_area: input.lostArea && facility.areas.includes(input.lostArea) ? input.lostArea : null,
      is_rental: input.isRental,
      contact_name: input.contactName,
      contact_email: input.contactEmail ? normalizeEmail(input.contactEmail) : null,
      contact_phone: input.contactPhone,
      contact_key: contactKey,
      secret_detail: input.secretDetail,
      consent_at: new Date().toISOString(),
      access_token: accessToken,
      created_via: "web",
      report_started_at: input.reportStartedAt,
    })
    .select("id")
    .single();
  if (insertError) return failed("report_insert", insertError.code);

  const { error: eventError } = await supabase.from("item_events").insert({
    facility_id: facility.id,
    lost_report_id: report.id,
    type: "report_created",
    payload: { created_via: "web" },
  });
  if (eventError) console.error(JSON.stringify({ event: "report_event_failed", code: eventError.code }));

  // Normalization and matching run after the response; P-04 shows "찾는 중" and refreshes meanwhile.
  after(() => processReport(report.id));
  redirect(`/r/${accessToken}?new=1`);
}

function parsePayload(raw: FormDataEntryValue | null): unknown {
  if (typeof raw !== "string") return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function findRecentDuplicate(
  supabase: ReturnType<typeof createAdminClient>,
  facilityId: string,
  contactKey: string | null,
  description: string,
  userCategory: string | null,
): Promise<string | null> {
  if (!contactKey) return null;
  const since = new Date(Date.now() - DUPLICATE_WINDOW_MS).toISOString();
  let query = supabase
    .from("lost_reports")
    .select("access_token")
    .eq("facility_id", facilityId)
    .eq("contact_key", contactKey)
    .eq("description", description)
    .gte("created_at", since)
    .limit(1);
  query = userCategory ? query.eq("user_category", userCategory) : query.is("user_category", null);
  const { data } = await query.maybeSingle();
  return data?.access_token ?? null;
}

function failed(step: string, code: string): CreateReportState {
  console.error(JSON.stringify({ event: "create_report_failed", step, code }));
  return { ok: false, error: "internal" };
}

export type AdminReportResult = { ok: true; data: { path: string } } | { ok: false; error: ErrorCode; fields?: ReportFieldError[] };

/**
 * A-07 [대리 신고 접수] (docs/04-architecture.md §6-2): the admin types in a report taken by phone or
 * at the desk. Runs as the admin (RLS: their facility only). The link goes back to the admin to pass on.
 */
export async function createReportByAdmin(input: unknown): Promise<AdminReportResult> {
  const parsed = LostReportInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_input" };
  const form = parsed.data;
  const fields = reportFieldErrors(form, seoulToday());
  if (fields.length > 0) return { ok: false, error: "invalid_input", fields };

  const { userId, facility } = await getAdminContext();
  const supabase = await createClient();
  const { data: fac, error: facError } = await supabase.from("facilities").select("areas").eq("id", facility.id).single();
  if (facError) return adminFailed("facility", facError.code);

  const accessToken = randomBytes(24).toString("base64url");
  const { data: report, error } = await supabase
    .from("lost_reports")
    .insert({
      facility_id: facility.id,
      description: form.description,
      user_category: form.userCategory,
      colors: form.colors,
      brand: form.brand,
      lost_from: form.lostFrom,
      lost_to: form.lostTo,
      lost_time_of_day: form.lostTimeOfDay,
      lost_area: form.lostArea && fac.areas.includes(form.lostArea) ? form.lostArea : null,
      is_rental: form.isRental,
      contact_name: form.contactName,
      contact_email: form.contactEmail ? normalizeEmail(form.contactEmail) : null,
      contact_phone: form.contactPhone,
      contact_key: toContactKey({ phone: form.contactPhone, email: form.contactEmail }),
      secret_detail: form.secretDetail,
      consent_at: new Date().toISOString(),
      access_token: accessToken,
      created_via: "admin",
      created_by: userId,
      report_started_at: form.reportStartedAt,
    })
    .select("id")
    .single();
  if (error) return adminFailed("insert", error.code);

  const { error: eventError } = await supabase
    .from("item_events")
    .insert({ facility_id: facility.id, lost_report_id: report.id, actor: userId, type: "report_created", payload: { created_via: "admin" } });
  if (eventError) console.error(JSON.stringify({ event: "report_event_failed", code: eventError.code }));

  after(() => processReport(report.id));
  return { ok: true, data: { path: `/r/${accessToken}` } };
}

/** A-07 drawer [다시 분석] (FL-032): the admin can see the report (RLS), then it is processed again. */
export async function retryReportAnalysis(input: { id: string }): Promise<ActionResult<{ id: string }>> {
  const parsed = z.object({ id: z.uuid() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_input" };
  await getAdminContext();
  const supabase = await createClient();
  const { data: report, error } = await supabase.from("lost_reports").select("id, ai_status").eq("id", parsed.data.id).maybeSingle();
  if (error) return adminFailed("retry_read", error.code);
  if (!report) return { ok: false, error: "not_found" };
  if (report.ai_status !== "failed") return { ok: false, error: "conflict" };

  // processReport keeps the report "찾는 중" while it runs, then writes the new status.
  await processReport(report.id);
  const { data: updated } = await supabase.from("lost_reports").select("ai_status").eq("id", report.id).single();
  refresh();
  return updated?.ai_status === "done" ? { ok: true, data: { id: report.id } } : { ok: false, error: "ai_failed" };
}

function adminFailed(step: string, code: string): { ok: false; error: ErrorCode } {
  console.error(JSON.stringify({ event: "admin_report_failed", step, code }));
  return { ok: false, error: "internal" };
}
