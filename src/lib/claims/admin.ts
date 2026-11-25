import "server-only";
import { z } from "zod";
import { signPhotoUrls } from "@/lib/storage";
import { BUCKETS } from "@/lib/storage-paths";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";
import { requiredProofFor, type RequiredProof } from "@/lib/validation/claim";
import { categoryLabel } from "@/lib/validation/constants";

// A-06 소유권 확인 요청 (docs/03-screens.md A-06, docs/02-user-flows.md §6). Admin only (RLS).
// ai_verdict and private features are shown here and nowhere on the public side.

type CandidateStatus = Database["public"]["Enums"]["candidate_status"];

/** Requests waiting for the facility: new ones and those waiting for proof. */
export const OPEN_CLAIM: CandidateStatus[] = ["claimed", "needs_proof"];
/** docs/05-ai-matching.md §9-4: this many different items from one contact in a week is a warning. */
export const CONTACT_CLAIM_WARNING = { items: 3, days: 7 } as const;

export type ClaimListRow = {
  id: string;
  claimedAt: string | null;
  status: CandidateStatus;
  category: string;
  thumbUrl: string | null;
  reporterName: string | null;
};

export async function listClaims(): Promise<{ status: "ok"; rows: ClaimListRow[] } | { status: "error" }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("match_candidates")
    .select("id, status, claimed_at, item:found_items(category, photo_paths), report:lost_reports(contact_name)")
    .in("status", OPEN_CLAIM)
    .order("claimed_at", { ascending: false });
  if (error) {
    console.error(JSON.stringify({ event: "claim_list_failed", code: error.code }));
    return { status: "error" };
  }
  const firstPhotos = data.flatMap((c) => (c.item?.photo_paths[0] ? [c.item.photo_paths[0]] : []));
  const thumbs = await signPhotoUrls(supabase, BUCKETS.foundItems, firstPhotos);
  return {
    status: "ok",
    rows: data.map((c) => ({
      id: c.id,
      claimedAt: c.claimed_at,
      status: c.status,
      category: c.item ? categoryLabel(c.item.category) : "",
      thumbUrl: c.item?.photo_paths[0] ? (thumbs.get(c.item.photo_paths[0]) ?? null) : null,
      reporterName: c.report?.contact_name ?? null,
    })),
  };
}

export type ClaimAnswer = { key: string; question: string; answer: string };

export type ClaimDetail = {
  id: string;
  status: CandidateStatus;
  claimedAt: string | null;
  attempt: number;
  answers: ClaimAnswer[];
  claimPhotoUrl: string | null;
  proof: { request: string | null; reply: string | null; photoUrl: string | null };
  reviewNote: string | null;
  pickupMessage: string | null;
  aiVerdict: unknown;
  report: { id: string; description: string; secretDetail: string | null; contact: { name: string | null; email: string | null; phone: string | null } };
  item: {
    id: string;
    category: string;
    categoryCode: string;
    summary: string;
    privateFeatures: string[];
    storageLocation: string | null;
    photoUrl: string | null;
    requiredProof: RequiredProof;
  };
  warnings: { otherRequests: number; contactRecentItems: number };
};

export async function getClaimDetail(id: string): Promise<{ status: "ok"; detail: ClaimDetail } | { status: "not_found" } | { status: "error" }> {
  if (!z.uuid().safeParse(id).success) return { status: "not_found" };
  const supabase = await createClient();
  const { data: c, error } = await supabase
    .from("match_candidates")
    .select(
      "id, status, claimed_at, claim_attempt, claim_answers, claim_photo_path, proof_request, proof_reply, proof_photo_path, review_note, pickup_message, ai_verdict, found_item_id, report:lost_reports(id, description, secret_detail, contact_name, contact_email, contact_phone, contact_key), item:found_items(id, category, public_summary, private_features, storage_location, photo_paths)",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) return failed("detail", error.code);
  if (!c || !c.report || !c.item) return { status: "not_found" };

  const since = new Date(Date.now() - CONTACT_CLAIM_WARNING.days * 86_400_000).toISOString();
  const [others, sameContact, itemPhotos, claimPhotos] = await Promise.all([
    supabase.from("match_candidates").select("id", { count: "exact", head: true }).eq("found_item_id", c.found_item_id).neq("id", id).in("status", OPEN_CLAIM),
    c.report.contact_key
      ? supabase.from("match_candidates").select("found_item_id, report:lost_reports!inner(contact_key)").eq("report.contact_key", c.report.contact_key).gte("claimed_at", since)
      : Promise.resolve({ data: [] as { found_item_id: string }[], error: null }),
    signPhotoUrls(supabase, BUCKETS.foundItems, c.item.photo_paths.slice(0, 1)),
    signPhotoUrls(supabase, BUCKETS.claimPhotos, [c.claim_photo_path, c.proof_photo_path].filter((p): p is string => Boolean(p))),
  ]);
  if (others.error || sameContact.error) return failed("warnings", others.error?.code ?? sameContact.error?.code ?? "");

  return {
    status: "ok",
    detail: {
      id: c.id,
      status: c.status,
      claimedAt: c.claimed_at,
      attempt: c.claim_attempt,
      answers: parseAnswers(c.claim_answers),
      claimPhotoUrl: c.claim_photo_path ? (claimPhotos.get(c.claim_photo_path) ?? null) : null,
      proof: { request: c.proof_request, reply: c.proof_reply, photoUrl: c.proof_photo_path ? (claimPhotos.get(c.proof_photo_path) ?? null) : null },
      reviewNote: c.review_note,
      pickupMessage: c.pickup_message,
      aiVerdict: c.ai_verdict,
      report: {
        id: c.report.id,
        description: c.report.description,
        secretDetail: c.report.secret_detail,
        contact: { name: c.report.contact_name, email: c.report.contact_email, phone: c.report.contact_phone },
      },
      item: {
        id: c.item.id,
        category: categoryLabel(c.item.category),
        categoryCode: c.item.category,
        summary: c.item.public_summary,
        privateFeatures: c.item.private_features,
        storageLocation: c.item.storage_location,
        photoUrl: c.item.photo_paths[0] ? (itemPhotos.get(c.item.photo_paths[0]) ?? null) : null,
        requiredProof: requiredProofFor(c.item.category),
      },
      warnings: {
        otherRequests: others.count ?? 0,
        contactRecentItems: new Set(sameContact.data.map((r) => r.found_item_id)).size,
      },
    },
  };
}

const AnswerSchema = z.array(z.object({ key: z.string(), question: z.string(), answer: z.string() }));

function parseAnswers(raw: unknown): ClaimAnswer[] {
  const parsed = AnswerSchema.safeParse(raw);
  return parsed.success ? parsed.data : [];
}

function failed(step: string, code: string): { status: "error" } {
  console.error(JSON.stringify({ event: "claim_detail_failed", step, code }));
  return { status: "error" };
}
