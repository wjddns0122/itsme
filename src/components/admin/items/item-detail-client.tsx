"use client";

import Image from "next/image";
import { useState, useTransition } from "react";
import { ItemForm } from "@/components/admin/register/item-form";
import type { RegisterValues } from "@/components/admin/register/register-state";
import { Icon } from "@/components/icon";
import { cn } from "@/lib/utils";
import { setFoundItemStatus, updateFoundItem } from "@/server/actions/items";
import ko from "../../../../messages/ko.json";

const t = ko.admin.item;

/** Large photo with dots and previous/next (Figma A-05 left column). */
export function PhotoViewer({ photos }: { photos: { url: string | null }[] }) {
  const [index, setIndex] = useState(0);
  const total = photos.length;
  const current = photos[index];
  return (
    <div className="flex flex-col gap-2.5">
      <div className="relative aspect-square w-full overflow-hidden rounded-ui-md bg-neutral-bg">
        {current?.url ? (
          <Image src={current.url} alt={t.photoCount.replace("{n}", String(index + 1)).replace("{total}", String(total))} fill unoptimized className="object-cover" />
        ) : (
          <span className="flex size-full flex-col items-center justify-center gap-1 text-caption font-medium text-ink-muted">
            <Icon name="image" size={24} />
            {total > 0 ? t.photoCount.replace("{n}", String(index + 1)).replace("{total}", String(total)) : ko.admin.items.noPhoto}
          </span>
        )}
        {total > 1 ? (
          <>
            <button type="button" aria-label={ko.admin.items.prev} onClick={() => setIndex((i) => (i - 1 + total) % total)} className="absolute top-1/2 left-2 flex size-11 -translate-y-1/2 items-center justify-center rounded-ui-pill bg-surface/80 text-section text-ink">
              ‹
            </button>
            <button type="button" aria-label={ko.admin.items.next} onClick={() => setIndex((i) => (i + 1) % total)} className="absolute top-1/2 right-2 flex size-11 -translate-y-1/2 items-center justify-center rounded-ui-pill bg-surface/80 text-section text-ink">
              ›
            </button>
          </>
        ) : null}
      </div>
      {total > 1 ? (
        <div className="flex gap-1.5">
          {photos.map((_, i) => (
            <span key={i} aria-hidden className={cn("size-2 rounded-ui-pill", i === index ? "bg-brand" : "bg-line")} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

type InfoRow = { label: string; value: string; highlight?: boolean };

/** 물건 정보 card with [수정]: switches to the same form as registration. */
export function ItemInfoCard({ id, rows, values, areas }: { id: string; rows: InfoRow[]; values: RegisterValues; areas: string[] }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(values);
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();

  const save = () =>
    startTransition(async () => {
      const result = await updateFoundItem({ ...draft, id, category: draft.category || "other.other" });
      setFailed(!result.ok);
      if (result.ok) setEditing(false);
    });

  if (editing) {
    return (
      <div className="flex flex-col gap-3">
        <ItemForm values={draft} aiFilled={new Set()} errors={{}} areas={areas} onChange={(key, value) => setDraft((d) => ({ ...d, [key]: value }))} />
        {failed ? <p role="alert" className="text-label font-bold text-danger">{t.failed}</p> : null}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={() => { setDraft(values); setEditing(false); }} className="flex h-11 items-center rounded-ui-sm border border-line-strong bg-surface px-4 text-button font-bold text-ink">
            {t.cancelEdit}
          </button>
          <button type="button" disabled={pending} onClick={save} className="flex h-11 items-center rounded-ui-sm bg-brand px-4 text-button font-bold text-on-brand disabled:opacity-85">
            {t.saveEdit}
          </button>
        </div>
      </div>
    );
  }

  return (
    <section className="flex flex-col gap-3 rounded-ui-md border border-line bg-surface p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-section font-bold tracking-[-0.01em] text-ink">{t.info}</h2>
        <button type="button" onClick={() => setEditing(true)} className="flex h-11 items-center rounded-ui-sm border border-line-strong bg-surface px-4 text-button font-bold text-ink">
          {t.edit}
        </button>
      </div>
      <dl className="flex flex-col gap-2">
        {rows.map((r) => (
          <div key={r.label} className={cn("flex items-start gap-3", r.highlight && "-mx-3 rounded-ui-sm bg-butter px-3 py-2.5")}>
            <dt className={cn("w-20 shrink-0 text-caption font-medium", r.highlight ? "font-bold text-butter-ink" : "text-ink-muted")}>{r.label}</dt>
            <dd className={cn("min-w-0 flex-1 text-body whitespace-pre-line text-ink", r.highlight && "font-bold")}>{r.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/** [경찰 이관] [폐기 처리] with an inline confirmation and an optional note. */
export function ItemStatusActions({ id }: { id: string }) {
  const [confirming, setConfirming] = useState<"transferred" | "disposed" | null>(null);
  const [note, setNote] = useState("");
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();

  const run = () =>
    startTransition(async () => {
      if (!confirming) return;
      const result = await setFoundItemStatus({ id, status: confirming, note: note.trim() || null });
      setFailed(!result.ok);
      if (result.ok) setConfirming(null);
    });

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex gap-2">
        <button type="button" onClick={() => setConfirming("transferred")} className="flex h-11 items-center rounded-ui-sm border border-line-strong bg-surface px-4 text-button font-bold text-ink">
          {t.actions.transfer}
        </button>
        <button type="button" onClick={() => setConfirming("disposed")} className="flex h-11 items-center rounded-ui-sm border border-danger bg-surface px-4 text-button font-bold text-danger">
          {t.actions.dispose}
        </button>
      </div>
      {confirming ? (
        <div role="alertdialog" aria-label={t.actions[confirming === "transferred" ? "transfer" : "dispose"]} className="flex w-full max-w-md flex-col gap-2.5 rounded-ui-md border border-line bg-surface p-3.5">
          <p className="text-desc text-ink">{confirming === "transferred" ? t.confirm.transfer : t.confirm.dispose}</p>
          <label className="flex flex-col gap-1 text-label font-bold text-ink">
            {t.confirm.note}
            <input value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} className="h-11 rounded-ui-sm border-[1.5px] border-line-strong bg-surface px-3 text-body font-normal text-ink outline-none focus-visible:border-brand" />
          </label>
          {failed ? <p role="alert" className="text-label font-bold text-danger">{t.failed}</p> : null}
          <div className="flex gap-2">
            <button type="button" disabled={pending} onClick={run} className="flex h-11 flex-1 items-center justify-center rounded-ui-sm bg-brand px-4 text-button font-bold text-on-brand disabled:opacity-85">
              {t.confirm.yes}
            </button>
            <button type="button" onClick={() => setConfirming(null)} className="flex h-11 flex-1 items-center justify-center rounded-ui-sm border border-line-strong bg-surface px-4 text-button font-bold text-ink">
              {t.confirm.no}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
