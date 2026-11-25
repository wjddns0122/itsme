"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { Icon } from "@/components/icon";
import { isImageFile, resizeToJpeg } from "@/lib/image-resize";
import ko from "../../messages/ko.json";

const t = ko.admin.register;
export const MAX_PHOTOS = 3;

export type PhotoItem = { file: File; url: string };

type Props = {
  photos: PhotoItem[];
  onAdd: (photos: PhotoItem[]) => void;
  onRemove: (index: number) => void;
  disabled?: boolean;
};

/**
 * FL-010 사진 촬영 (Figma A-03 "photos" card): camera on phones (capture="environment") or album,
 * up to 3 photos, each shrunk to a 1280px JPEG before it leaves the browser.
 */
export function PhotoCapture({ photos, onAdd, onRemove, disabled }: Props) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const albumRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const room = MAX_PHOTOS - photos.length;

  const handleFiles = async (list: FileList | null) => {
    const files = Array.from(list ?? []);
    if (files.length === 0) return;
    if (!files.every(isImageFile)) {
      setError(t.notImage);
      return;
    }
    setError(files.length > room ? t.tooMany : null);
    setBusy(true);
    const resized = await Promise.all(files.slice(0, room).map(resizeToJpeg));
    setBusy(false);
    onAdd(resized.map((file) => ({ file, url: URL.createObjectURL(file) })));
  };

  const [main, ...rest] = photos;
  const pickers = (
    <>
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="sr-only" tabIndex={-1} onChange={(e) => { void handleFiles(e.target.files); e.target.value = ""; }} />
      <input ref={albumRef} type="file" accept="image/*" multiple className="sr-only" tabIndex={-1} onChange={(e) => { void handleFiles(e.target.files); e.target.value = ""; }} />
    </>
  );

  return (
    <section className="flex flex-col gap-2.5 rounded-ui-md border border-line bg-surface p-4" aria-busy={busy}>
      {pickers}
      <div className="flex items-center justify-between">
        <h2 className="text-label font-bold text-ink">{t.photos}</h2>
        <span className="text-caption font-medium text-ink-muted">{t.maxPhotos}</span>
      </div>

      {main ? (
        <PhotoTile photo={main} index={0} onRemove={onRemove} disabled={disabled} large />
      ) : (
        <div className="flex aspect-square w-full flex-col items-center justify-center gap-2.5 rounded-ui-sm bg-neutral-bg p-4">
          <Icon name="image" size={24} />
          <button type="button" disabled={disabled || busy} onClick={() => cameraRef.current?.click()} className="flex h-11 w-full max-w-[180px] items-center justify-center rounded-ui-sm bg-brand text-button font-bold text-on-brand disabled:opacity-60">
            {t.takePhoto}
          </button>
          <button type="button" disabled={disabled || busy} onClick={() => albumRef.current?.click()} className="flex h-11 w-full max-w-[180px] items-center justify-center rounded-ui-sm border border-line-strong bg-surface text-button font-bold text-ink disabled:opacity-60">
            {t.pickAlbum}
          </button>
        </div>
      )}

      {main ? (
        <div className="flex gap-2">
          {rest.map((p, i) => (
            <PhotoTile key={p.url} photo={p} index={i + 1} onRemove={onRemove} disabled={disabled} />
          ))}
          {room > 0 ? (
            <button
              type="button"
              disabled={disabled || busy}
              onClick={() => albumRef.current?.click()}
              aria-label={t.pickAlbum}
              className="flex size-16 items-center justify-center rounded-ui-sm border-[1.5px] border-dashed border-line-strong bg-surface disabled:opacity-60"
            >
              <Icon name="plus-muted" size={22} />
            </button>
          ) : null}
        </div>
      ) : null}

      {error ? <p role="alert" className="text-caption font-bold text-danger">{error}</p> : null}
    </section>
  );
}

function PhotoTile({ photo, index, onRemove, disabled, large }: { photo: PhotoItem; index: number; onRemove: (i: number) => void; disabled?: boolean; large?: boolean }) {
  return (
    <div className={large ? "relative aspect-square w-full" : "relative size-16"}>
      <Image src={photo.url} alt={t.photoAlt.replace("{n}", String(index + 1))} fill unoptimized className="rounded-ui-sm object-cover" />
      <button
        type="button"
        disabled={disabled}
        onClick={() => onRemove(index)}
        aria-label={t.removePhoto.replace("{n}", String(index + 1))}
        className="absolute top-1 right-1 flex size-7 items-center justify-center rounded-ui-pill bg-ink/70 text-caption font-bold text-on-brand disabled:hidden"
      >
        ✕
      </button>
    </div>
  );
}
