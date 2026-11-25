"use client";

import Image from "next/image";
import { useEffect, useState, useTransition } from "react";
import { ItemForm } from "@/components/admin/register/item-form";
import type { RegisterValues } from "@/components/admin/register/register-state";
import { Icon } from "@/components/icon";
import { cn } from "@/lib/utils";
import { Modal } from "@/components/admin/modal";
import { FieldError } from "@/components/public/report/controls";
import { returnMethodsFor, type RETURN_METHODS } from "@/lib/validation/claim";
import { useRouter } from "next/navigation";
import { markReturned } from "@/server/actions/candidates";
import { retryAnalysis, setFoundItemStatus, updateFoundItem } from "@/server/actions/items";
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

export type ReturnOption = { candidateId: string; name: string | null; date: string; firstLine: string };

/** [반환 처리] [경찰 이관] [폐기 처리]. Transfer and disposal confirm inline with an optional note. */
export function ItemStatusActions({ id, category, subtitle, returnOptions }: { id: string; category: string; subtitle: string; returnOptions: ReturnOption[] }) {
  const [returning, setReturning] = useState(false);
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
      <div className="flex flex-wrap justify-end gap-2">
        <button type="button" onClick={() => setReturning(true)} className="flex h-11 items-center rounded-ui-sm bg-brand px-4 text-button font-bold text-on-brand">
          {t.actions.return}
        </button>
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
      {returning ? <ReturnDialog itemId={id} category={category} subtitle={subtitle} options={returnOptions} onClose={() => setReturning(false)} /> : null}
    </div>
  );
}

const r = ko.admin.return;

/** A-09 반환 처리 (Figma 22:2530): linked report or none, recipient (required), how it was checked, memo. */
function ReturnDialog({ itemId, category, subtitle, options, onClose }: { itemId: string; category: string; subtitle: string; options: ReturnOption[]; onClose: () => void }) {
  const router = useRouter();
  const methods = returnMethodsFor(category);
  const [candidateId, setCandidateId] = useState<string | null>(options[0]?.candidateId ?? null);
  const [recipient, setRecipient] = useState(options[0]?.name ?? "");
  const [method, setMethod] = useState<(typeof RETURN_METHODS)[number]>("id_check");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const choose = (option: ReturnOption | null) => {
    setCandidateId(option?.candidateId ?? null);
    if (option?.name && !recipient.trim()) setRecipient(option.name);
  };
  const submit = () =>
    startTransition(async () => {
      if (!recipient.trim()) {
        setError(r.recipientRequired);
        return;
      }
      const result = await markReturned({ itemId, candidateId, recipient, method, note: note.trim() || null });
      if (!result.ok) {
        setError(r.failed);
        return;
      }
      onClose();
      router.replace(`/admin/items/${itemId}?returned=1`);
    });

  const radio = (selected: boolean) =>
    cn("flex w-full items-center gap-3 rounded-ui-md border px-4 py-3 text-left", selected ? "border-brand bg-blush" : "border-line bg-surface");
  return (
    <Modal title={r.title} subtitle={subtitle} onClose={onClose}>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-label font-bold text-ink">{r.linked}</legend>
        {options.map((o) => (
          <button key={o.candidateId} type="button" role="radio" aria-checked={candidateId === o.candidateId} onClick={() => choose(o)} className={radio(candidateId === o.candidateId)}>
            <RadioDot on={candidateId === o.candidateId} />
            <span className="flex min-w-0 flex-col">
              <span className="text-body font-bold text-ink">{o.name ? r.reportOf.replace("{name}", o.name) : r.reportAnon}</span>
              <span className="truncate text-caption font-medium text-ink-muted">{[o.date, o.firstLine].filter(Boolean).join(" · ")}</span>
            </span>
          </button>
        ))}
        <button type="button" role="radio" aria-checked={candidateId === null} onClick={() => choose(null)} className={radio(candidateId === null)}>
          <RadioDot on={candidateId === null} />
          <span className="flex flex-col">
            <span className="text-body font-bold text-ink">{r.none}</span>
            <span className="text-caption font-medium text-ink-muted">{r.noneHint}</span>
          </span>
        </button>
      </fieldset>
      <label className="flex flex-col gap-2 text-label font-bold text-ink">
        <span className="flex items-center gap-1.5">
          {r.recipient}
          <span className="rounded-[6px] bg-blush px-1.5 text-caption font-bold text-blush-ink">{r.required}</span>
        </span>
        <input value={recipient} maxLength={30} onChange={(e) => setRecipient(e.target.value)} aria-invalid={error === r.recipientRequired || undefined} className="h-12 rounded-ui-sm border-[1.5px] border-line-strong bg-surface px-3.5 text-body font-normal text-ink outline-none focus-visible:border-brand aria-invalid:border-danger" />
      </label>
      <div role="radiogroup" aria-label={r.method} className="flex flex-col gap-2">
        <span className="text-label font-bold text-ink">{r.method}</span>
        <div className="flex flex-wrap gap-1.5">
          {methods.map((m) => (
            <button key={m} type="button" role="radio" aria-checked={method === m} onClick={() => setMethod(m)} className={cn("flex h-9 items-center rounded-ui-pill border px-3 text-label font-bold", method === m ? "border-brand bg-blush text-blush-ink" : "border-line bg-surface text-ink")}>
              {r.methods[m]}
            </button>
          ))}
        </div>
        {methods.length < 6 ? <p className="text-caption font-medium text-ink-muted">{r.strictHint}</p> : null}
      </div>
      <label className="flex flex-col gap-2 text-label font-bold text-ink">
        {r.note}
        <textarea value={note} maxLength={200} rows={2} onChange={(e) => setNote(e.target.value)} className="min-h-[68px] rounded-ui-sm border-[1.5px] border-line-strong bg-surface px-3.5 py-3 text-body font-normal text-ink outline-none focus-visible:border-brand" />
      </label>
      <FieldError message={error} />
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onClose} className="flex h-11 items-center rounded-ui-sm border border-line-strong bg-surface px-4 text-button font-bold text-ink">
          {r.cancel}
        </button>
        <button type="button" disabled={pending} onClick={submit} className="flex h-11 items-center gap-1.5 rounded-ui-sm bg-brand px-4 text-button font-bold text-on-brand disabled:opacity-85">
          {pending ? <Icon name="spinner" size={16} className="animate-spin" /> : null}
          {r.submit}
        </button>
      </div>
    </Modal>
  );
}

function RadioDot({ on }: { on: boolean }) {
  return (
    <span aria-hidden className={cn("flex size-5 shrink-0 items-center justify-center rounded-ui-pill border-2", on ? "border-brand" : "border-line-strong")}>
      {on ? <span className="size-2.5 rounded-ui-pill bg-brand" /> : null}
    </span>
  );
}

/** Photo analysis failed at registration (FL-032): banner with [다시 분석]. */
export function RetryAnalysis({ id }: { id: string }) {
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();
  const run = () =>
    startTransition(async () => {
      const result = await retryAnalysis({ id });
      setFailed(!result.ok);
    });

  return (
    <div role="status" className="flex flex-wrap items-center gap-3 rounded-ui-md bg-warn-bg px-4 py-3">
      <Icon name="alert-circle" size={18} />
      <p className="min-w-0 flex-1 text-desc text-ink">{failed ? t.retryFailed : t.aiFailed}</p>
      <button type="button" disabled={pending} onClick={run} className="flex h-11 items-center gap-1.5 rounded-ui-sm border border-line-strong bg-surface px-4 text-button font-bold text-ink disabled:opacity-85">
        {pending ? <Icon name="spinner" size={16} className="animate-spin" /> : null}
        {t.retryAnalysis}
      </button>
    </div>
  );
}

/** Figma 22:2963: "반환 완료했어요." for a few seconds after A-09. */
export function ReturnedToast({ text }: { text: string }) {
  const [shown, setShown] = useState(true);
  useEffect(() => {
    const timer = window.setTimeout(() => setShown(false), 4000);
    return () => window.clearTimeout(timer);
  }, []);
  if (!shown) return null;
  return (
    <p role="status" className="fixed bottom-20 left-1/2 z-40 flex -translate-x-1/2 items-center gap-2 rounded-ui-pill bg-ink px-4 py-2.5 text-label font-bold text-on-brand shadow-pop md:bottom-8">
      <Icon name="check" size={16} />
      {text}
    </p>
  );
}
