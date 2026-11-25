"use server";

import { refresh } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { getAi } from "@/lib/ai/client";
import { extractFoundItem, type ExtractionResult } from "@/lib/ai/extract";
import { getAdminContext } from "@/lib/auth/admin";
import { addDaysToInstant, seoulLocalToIso } from "@/lib/dates";
import { processItem } from "@/lib/matching/process";
import { buildSearchText } from "@/lib/matching/search-text";
import { uploadFoundItemPhoto } from "@/lib/storage";
import { BUCKETS, facilityIdOfPath } from "@/lib/storage-paths";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/types";
import type { FoundItemExtraction } from "@/lib/validation/ai";
import { categoryLabel, isSensitiveCategory } from "@/lib/validation/constants";
import {
  FoundItemFormSchema,
  ITEM_LIMITS,
  ItemStatusChangeSchema,
  MAX_PHOTO_BYTES,
  SensitiveItemSchema,
  UpdateItemSchema,
  splitFeatures,
  type FoundItemForm,
  type UpdateItemInput,
} from "@/lib/validation/item";
import type { ActionResult } from "./result";

// 습득물 등록 (A-03, docs/04-architecture.md §6-1). Admin actions: they run as the signed-in admin,
// so RLS and the storage policy limit every read and write to their own facility.

export type AiMeta = { model: string; latencyMs: number; raw: Record<string, unknown> };
export type AnalyzePhotoData = { photoPaths: string[]; extraction: FoundItemExtraction | null; ai: AiMeta | null };

/** Uploads 1–3 photos and asks Gemini to fill the form at the same time. AI failure is not an error. */
export async function analyzePhoto(formData: FormData): Promise<ActionResult<AnalyzePhotoData>> {
  const { facility } = await getAdminContext();
  const photos = readPhotos(formData, 1);
  if (!photos) return { ok: false, error: "invalid_input" };
  const foundArea = typeof formData.get("foundArea") === "string" ? (formData.get("foundArea") as string) || null : null;

  const supabase = await createClient();
  const { data: fac, error } = await supabase.from("facilities").select("type").eq("id", facility.id).single();
  if (error) return failed("facility", error.code);

  const [uploads, ai] = await Promise.all([
    Promise.all(photos.map((p) => uploadFoundItemPhoto(supabase, facility.id, p))),
    runExtraction(photos, fac.type, foundArea),
  ]);
  const photoPaths = uploads.flatMap((u) => (u.ok ? [u.path] : []));
  if (photoPaths.length !== photos.length) return failed("upload", "upload_failed");

  return {
    ok: true,
    data: {
      photoPaths,
      extraction: ai.ok ? ai.extraction : null,
      ai: ai.ok ? { model: ai.model, latencyMs: ai.latencyMs, raw: ai.raw } : null,
    },
  };
}

/** Photos added after the analysis: stored only, not analyzed again. */
export async function uploadItemPhotos(formData: FormData): Promise<ActionResult<{ photoPaths: string[] }>> {
  const { facility } = await getAdminContext();
  const photos = readPhotos(formData, 1);
  if (!photos) return { ok: false, error: "invalid_input" };
  const supabase = await createClient();
  const uploads = await Promise.all(photos.map((p) => uploadFoundItemPhoto(supabase, facility.id, p)));
  const photoPaths = uploads.flatMap((u) => (u.ok ? [u.path] : []));
  if (photoPaths.length !== photos.length) return failed("upload_extra", "upload_failed");
  return { ok: true, data: { photoPaths } };
}

/** Saves the checked form. Reverse matching runs after the response. */
export async function createFoundItem(input: FoundItemForm): Promise<ActionResult<{ id: string }>> {
  const parsed = FoundItemFormSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_input" };
  const form = parsed.data;

  const { userId, facility } = await getAdminContext();
  const foundAt = seoulLocalToIso(form.foundAt);
  if (!foundAt || form.photoPaths.some((p) => facilityIdOfPath(p) !== facility.id)) return { ok: false, error: "invalid_input" };

  const supabase = await createClient();
  const { data: fac, error: facError } = await supabase.from("facilities").select("transfer_days, areas").eq("id", facility.id).single();
  if (facError) return failed("facility", facError.code);

  const privateFeatures = splitFeatures(form.privateFeatures);
  const features = form.extraction?.features ?? [];
  const material = form.extraction?.material ?? null;
  const aiStatus = form.extraction ? "done" : form.photoPaths.length > 0 ? "failed" : "skipped";

  const { data: item, error } = await supabase
    .from("found_items")
    .insert({
      facility_id: facility.id,
      category: form.category,
      subcategory: form.subcategory,
      colors: form.colors,
      brand: form.brand,
      material,
      features,
      public_summary: form.publicSummary,
      private_features: privateFeatures,
      is_sensitive: form.isSensitive || isSensitiveCategory(form.category),
      search_text: buildSearchText({ category: form.category, subcategory: form.subcategory, colors: form.colors, brand: form.brand, material, features }, privateFeatures),
      photo_paths: form.photoPaths,
      found_at: foundAt,
      found_area: form.foundArea && fac.areas.includes(form.foundArea) ? form.foundArea : null,
      storage_location: form.storageLocation,
      transfer_due_at: addDaysToInstant(foundAt, fac.transfer_days),
      ai_status: aiStatus,
      ai_confidence: form.extraction?.confidence ?? null,
      ai_model: form.extraction?.model ?? null,
      ai_latency_ms: form.extraction?.latencyMs ?? null,
      ai_raw: form.extraction ? (form.extraction.raw as Json) : null,
      register_started_at: form.registerStartedAt,
      created_by: userId,
    })
    .select("id")
    .single();
  if (error) return failed("insert", error.code);

  await recordRegistered(supabase, facility.id, item.id, userId, { ai_status: aiStatus });
  after(() => processItem(item.id));
  return { ok: true, data: { id: item.id } };
}

/**
 * [민감 물품]: IDs and cards are saved without AI analysis. The photos stay in our storage and are
 * never sent to an outside AI (docs/03 A-03).
 */
export async function createSensitiveItem(formData: FormData): Promise<ActionResult<{ id: string }>> {
  const parsed = SensitiveItemSchema.safeParse(parsePayload(formData.get("payload")));
  const photos = readPhotos(formData, 0);
  if (!parsed.success || !photos) return { ok: false, error: "invalid_input" };
  const form = parsed.data;

  const { userId, facility } = await getAdminContext();
  const foundAt = seoulLocalToIso(form.foundAt);
  if (!foundAt) return { ok: false, error: "invalid_input" };

  const supabase = await createClient();
  const { data: fac, error: facError } = await supabase.from("facilities").select("transfer_days, areas").eq("id", facility.id).single();
  if (facError) return failed("facility", facError.code);

  const uploads = await Promise.all(photos.map((p) => uploadFoundItemPhoto(supabase, facility.id, p)));
  const photoPaths = uploads.flatMap((u) => (u.ok ? [u.path] : []));
  if (photoPaths.length !== photos.length) return failed("upload", "upload_failed");

  const label = categoryLabel(form.category);
  const { data: item, error } = await supabase
    .from("found_items")
    .insert({
      facility_id: facility.id,
      category: form.category,
      public_summary: label,
      is_sensitive: true,
      search_text: buildSearchText({ category: form.category, subcategory: null, colors: [], brand: null, material: null, features: [] }),
      photo_paths: photoPaths,
      found_at: foundAt,
      found_area: form.foundArea && fac.areas.includes(form.foundArea) ? form.foundArea : null,
      storage_location: form.storageLocation,
      transfer_due_at: addDaysToInstant(foundAt, fac.transfer_days),
      ai_status: "skipped",
      register_started_at: form.registerStartedAt,
      created_by: userId,
    })
    .select("id")
    .single();
  if (error) return failed("insert_sensitive", error.code);

  await recordRegistered(supabase, facility.id, item.id, userId, { ai_status: "skipped", sensitive: true });
  after(() => processItem(item.id));
  return { ok: true, data: { id: item.id } };
}

/** A-05 [수정]. Search text is rebuilt so matching and keyword search see the new values. */
export async function updateFoundItem(input: UpdateItemInput): Promise<ActionResult<{ id: string }>> {
  const parsed = UpdateItemSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_input" };
  const form = parsed.data;
  const foundAt = seoulLocalToIso(form.foundAt);
  if (!foundAt) return { ok: false, error: "invalid_input" };

  const { userId, facility } = await getAdminContext();
  const supabase = await createClient();
  const [{ data: current, error: readError }, { data: fac, error: facError }] = await Promise.all([
    supabase.from("found_items").select("features, material, status, category, colors, brand, subcategory, private_features, found_at, found_area").eq("id", form.id).maybeSingle(),
    supabase.from("facilities").select("transfer_days, areas").eq("id", facility.id).single(),
  ]);
  if (readError || facError) return failed("update_read", readError?.code ?? facError?.code ?? "");
  if (!current) return { ok: false, error: "not_found" };

  const privateFeatures = splitFeatures(form.privateFeatures);
  const { error } = await supabase
    .from("found_items")
    .update({
      category: form.category,
      subcategory: form.subcategory,
      colors: form.colors,
      brand: form.brand,
      public_summary: form.publicSummary,
      private_features: privateFeatures,
      is_sensitive: form.isSensitive || isSensitiveCategory(form.category),
      search_text: buildSearchText({ category: form.category, subcategory: form.subcategory, colors: form.colors, brand: form.brand, material: current.material, features: current.features }, privateFeatures),
      found_at: foundAt,
      found_area: form.foundArea && fac.areas.includes(form.foundArea) ? form.foundArea : null,
      storage_location: form.storageLocation,
      transfer_due_at: addDaysToInstant(foundAt, fac.transfer_days),
    })
    .eq("id", form.id);
  if (error) return failed("update", error.code);

  // Fields that change what the item looks like (docs/05-ai-matching.md §6).
  const featureChanged =
    current.category !== form.category ||
    current.subcategory !== form.subcategory ||
    current.brand !== form.brand ||
    current.colors.join() !== form.colors.join() ||
    current.private_features.join() !== privateFeatures.join();
  const { error: eventError } = await supabase
    .from("item_events")
    .insert({ facility_id: facility.id, found_item_id: form.id, actor: userId, type: "edited", payload: { feature_changed: featureChanged } });
  if (eventError) console.error(JSON.stringify({ event: "item_event_failed", code: eventError.code }));

  // Place and date are scored too, so they also re-run the reverse matching.
  const foundArea = form.foundArea && fac.areas.includes(form.foundArea) ? form.foundArea : null;
  if (featureChanged || current.found_area !== foundArea || new Date(current.found_at).getTime() !== new Date(foundAt).getTime()) {
    after(() => processItem(form.id));
  }
  refresh();
  return { ok: true, data: { id: form.id } };
}

/**
 * A-05 [다시 분석] (FL-032): the photo analysis failed at registration. Fills only the fields the
 * form does not show (features, material) so nothing the admin typed is overwritten, then matches
 * again. Sensitive items are never sent to the outside AI.
 */
export async function retryAnalysis(input: { id: string }): Promise<ActionResult<{ id: string }>> {
  const parsed = z.object({ id: z.uuid() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_input" };
  const { id } = parsed.data;
  const { facility } = await getAdminContext();
  const supabase = await createClient();

  const [{ data: item, error: readError }, { data: fac, error: facError }] = await Promise.all([
    supabase.from("found_items").select("ai_status, is_sensitive, photo_paths, found_area, category, subcategory, colors, brand, private_features").eq("id", id).maybeSingle(),
    supabase.from("facilities").select("type").eq("id", facility.id).single(),
  ]);
  if (readError || facError) return failed("retry_read", readError?.code ?? facError?.code ?? "");
  if (!item) return { ok: false, error: "not_found" };
  if (item.ai_status !== "failed" || item.is_sensitive || isSensitiveCategory(item.category) || item.photo_paths.length === 0) return { ok: false, error: "conflict" };

  const downloads = await Promise.all(item.photo_paths.map((path) => supabase.storage.from(BUCKETS.foundItems).download(path)));
  const photos = downloads.flatMap((d) => (d.data ? [d.data] : []));
  if (photos.length === 0) return failed("retry_download", "download_failed");

  const ai = await runExtraction(photos, fac.type, item.found_area);
  if (!ai.ok) return { ok: false, error: "ai_failed" };
  // The model saw a card or an ID: keep its features out and send the item to "확인 필요".
  const sensitive = ai.extraction.is_sensitive;
  const features = sensitive ? [] : ai.extraction.features;
  const material = sensitive ? null : ai.extraction.material;
  const { confidence } = ai.extraction;
  const { error } = await supabase
    .from("found_items")
    .update({
      features,
      material,
      ...(sensitive ? { is_sensitive: true, review_needed: true } : {}),
      search_text: buildSearchText({ category: item.category, subcategory: item.subcategory, colors: item.colors, brand: item.brand, material, features }, item.private_features),
      ai_status: "done",
      ai_confidence: confidence,
      ai_model: ai.model,
      ai_latency_ms: ai.latencyMs,
      ai_raw: ai.raw as Json,
    })
    .eq("id", id)
    .eq("ai_status", "failed");
  if (error) return failed("retry_update", error.code);

  after(() => processItem(id));
  refresh();
  return { ok: true, data: { id } };
}

/** A-05 [경찰 이관] / [폐기 처리]: one transaction in set_found_item_status (FL-043). */
export async function setFoundItemStatus(input: { id: string; status: "transferred" | "disposed"; note: string | null }): Promise<ActionResult<{ id: string }>> {
  const parsed = ItemStatusChangeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_input" };
  await getAdminContext();
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_found_item_status", { p_item_id: parsed.data.id, p_status: parsed.data.status, p_note: parsed.data.note ?? undefined });
  if (error) return failed("set_status", error.code);
  refresh();
  return { ok: true, data: { id: parsed.data.id } };
}

function readPhotos(formData: FormData, min: number): File[] | null {
  const files = formData.getAll("photos").filter((v): v is File => v instanceof File && v.size > 0);
  if (files.length < min || files.length > ITEM_LIMITS.photos) return null;
  const allImages = files.every((f) => f.type.startsWith("image/") && f.size <= MAX_PHOTO_BYTES);
  return allImages ? files : null;
}

async function runExtraction(photos: Blob[], facilityType: string, foundArea: string | null): Promise<ExtractionResult> {
  try {
    const { client, env } = getAi();
    const encoded = await Promise.all(
      photos.map(async (p) => ({ mimeType: p.type || "image/jpeg", base64: Buffer.from(await p.arrayBuffer()).toString("base64") })),
    );
    return await extractFoundItem({ client, model: env.VISION_MODEL, photos: encoded, facilityType, foundArea });
  } catch (error) {
    // Missing key or model settings: same path as an AI failure (manual entry).
    console.error(JSON.stringify({ event: "ai_extract_unavailable", message: error instanceof Error ? error.message : "unknown" }));
    return { ok: false, model: "", latencyMs: 0 };
  }
}

async function recordRegistered(
  supabase: Awaited<ReturnType<typeof createClient>>,
  facilityId: string,
  itemId: string,
  userId: string,
  payload: Record<string, string | boolean>,
) {
  const { error } = await supabase.from("item_events").insert({ facility_id: facilityId, found_item_id: itemId, actor: userId, type: "registered", payload });
  if (error) console.error(JSON.stringify({ event: "item_event_failed", code: error.code }));
}

function parsePayload(raw: FormDataEntryValue | null): unknown {
  if (typeof raw !== "string") return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function failed<T>(step: string, code: string): ActionResult<T> {
  console.error(JSON.stringify({ event: "item_action_failed", step, code }));
  return { ok: false, error: "internal" };
}
