"use server";

import { refresh } from "next/cache";
import { getAdminContext } from "@/lib/auth/admin";
import { createClient } from "@/lib/supabase/server";
import { MarkReturnedSchema, ReviewClaimSchema, returnMethodsFor, type MarkReturnedInput, type ReviewClaimInput } from "@/lib/validation/claim";
import type { ActionResult } from "./result";

// 소유권 검토와 반환 (A-06, A-09; docs/04-architecture.md §6-3). Each change of candidate, item and
// report runs in one DB function as the signed-in admin, so RLS keeps it inside their facility.

/** A-06 [승인] [추가 증빙 요청] [보류] [거절]. AI never decides: only this admin action approves. */
export async function reviewClaim(input: ReviewClaimInput): Promise<ActionResult<{ id: string }>> {
  const parsed = ReviewClaimSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_input" };
  await getAdminContext();
  const supabase = await createClient();
  const { id, action, message, note } = parsed.data;
  // SQL arguments accept null; generated types never mark function arguments nullable.
  const { error } = await supabase.rpc("review_claim", { p_candidate_id: id, p_action: action, p_message: (message || null) as string, p_note: (note || null) as string });
  if (error) {
    console.error(JSON.stringify({ event: "review_claim_failed", action, code: error.code }));
    return { ok: false, error: error.code === "P0001" ? "conflict" : "internal" };
  }
  refresh();
  return { ok: true, data: { id } };
}

/** A-09 [반환 완료]: item returned, linked report resolved, other candidates dismissed (mark_returned). */
export async function markReturned(input: MarkReturnedInput): Promise<ActionResult<{ id: string }>> {
  const parsed = MarkReturnedSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_input" };
  await getAdminContext();
  const supabase = await createClient();
  const { itemId, candidateId, recipient, method, note } = parsed.data;
  const { data: item } = await supabase.from("found_items").select("category").eq("id", itemId).maybeSingle();
  if (!item) return { ok: false, error: "not_found" };
  if (!returnMethodsFor(item.category).includes(method)) return { ok: false, error: "invalid_input" };
  const { error } = await supabase.rpc("mark_returned", {
    p_item_id: itemId,
    p_candidate_id: candidateId as string,
    p_recipient: recipient,
    p_method: method,
    p_note: (note || null) as string,
  });
  if (error) {
    console.error(JSON.stringify({ event: "mark_returned_failed", code: error.code }));
    return { ok: false, error: error.code === "P0001" ? "conflict" : "internal" };
  }
  refresh();
  return { ok: true, data: { id: itemId } };
}
