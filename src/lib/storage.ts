import "server-only";
import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { BUCKETS, SIGNED_URL_TTL_SECONDS, foundItemPhotoPath, type BucketName } from "./storage-paths";
import type { Database } from "./supabase/types";

type Client = SupabaseClient<Database>;

export type UploadResult = { ok: true; path: string } | { ok: false; error: "upload_failed" };

/**
 * Uploads one found-item photo with the admin's own client, so the storage policy checks
 * that the facility folder is theirs. The client resizes to a 1280px JPEG first (docs/04 §6-1).
 */
export async function uploadFoundItemPhoto(client: Client, facilityId: string, photo: Blob): Promise<UploadResult> {
  return uploadPhoto(client, BUCKETS.foundItems, foundItemPhotoPath(facilityId, randomUUID()), photo);
}

/** Generic upload for paths built with lib/storage-paths. Never overwrites an existing object. */
export async function uploadPhoto(client: Client, bucket: BucketName, path: string, photo: Blob): Promise<UploadResult> {
  const { error } = await client.storage
    .from(bucket)
    .upload(path, photo, { contentType: photo.type || "image/jpeg", upsert: false });
  return error ? { ok: false, error: "upload_failed" } : { ok: true, path };
}

/**
 * 10-minute signed URLs for admin screens, keyed by path. Paths the caller may not read
 * (another facility's folder) are simply missing from the result.
 */
export async function signPhotoUrls(client: Client, bucket: BucketName, paths: readonly string[]): Promise<Map<string, string>> {
  if (paths.length === 0) return new Map();
  const { data, error } = await client.storage.from(bucket).createSignedUrls([...paths], SIGNED_URL_TTL_SECONDS);
  if (error || !data) return new Map();
  return new Map(data.flatMap((d) => (d.path && d.signedUrl && !d.error ? [[d.path, d.signedUrl] as const] : [])));
}
