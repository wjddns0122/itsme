// Photos are shrunk in the browser before upload: long side 1280px, JPEG quality 0.8
// (docs/04-architecture.md §6-1). Keeps uploads under the 5MB Server Action limit and AI calls cheap.

export const RESIZE = { maxSide: 1280, quality: 0.8 } as const;

/** Target size that fits within maxSide on the long side, never upscaling. */
export function fitWithin(width: number, height: number, maxSide: number = RESIZE.maxSide): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= maxSide) return { width, height };
  const scale = maxSide / longest;
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

export function isImageFile(file: File): boolean {
  return file.type.startsWith("image/");
}

/** Browser only. Falls back to the original file if the browser cannot decode it (e.g. some HEIC). */
export async function resizeToJpeg(file: File): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const { width, height } = fitWithin(bitmap.width, bitmap.height);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", RESIZE.quality));
    if (!blob) return file;
    const name = file.name.replace(/\.[^.]+$/, "") || "photo";
    return new File([blob], `${name}.jpg`, { type: "image/jpeg" });
  } catch {
    return file;
  }
}
