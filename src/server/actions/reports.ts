"use server";

import { randomBytes } from "node:crypto";
import { redirect } from "next/navigation";
import { seoulToday } from "@/lib/dates";
import { FacilitySlugSchema } from "@/lib/facilities/page-data";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeEmail, toContactKey } from "@/lib/validation/contact";
import { LostReportInputSchema, reportFieldErrors, type ReportFieldError } from "@/lib/validation/report";
import type { ErrorCode } from "./result";

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
