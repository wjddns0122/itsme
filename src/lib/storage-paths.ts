import { z } from "zod";

// Bucket names and object paths: docs/04-architecture.md §5-2. Storage policies read the first
// folder as the facility id, so every path must start with it.
export const BUCKETS = {
  foundItems: "found-items",
  claimPhotos: "claim-photos",
  reportPhotos: "report-photos",
} as const;

export type BucketName = (typeof BUCKETS)[keyof typeof BUCKETS];

/** Admins see photos through signed URLs that expire after 10 minutes. */
export const SIGNED_URL_TTL_SECONDS = 600;

const Uuid = z.uuid();

export function foundItemPhotoPath(facilityId: string, fileId: string): string {
  return `${Uuid.parse(facilityId)}/${Uuid.parse(fileId)}.jpg`;
}

export function claimPhotoPath(facilityId: string, candidateId: string, fileId: string): string {
  return `${Uuid.parse(facilityId)}/${Uuid.parse(candidateId)}/${Uuid.parse(fileId)}.jpg`;
}

export function reportPhotoPath(facilityId: string, reportId: string, fileId: string): string {
  return `${Uuid.parse(facilityId)}/${Uuid.parse(reportId)}/${Uuid.parse(fileId)}.jpg`;
}

/** The facility a stored path belongs to, or null when the path is not one of ours. */
export function facilityIdOfPath(path: string): string | null {
  const first = path.split("/")[0] ?? "";
  return Uuid.safeParse(first).success ? first : null;
}
