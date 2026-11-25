"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Modal } from "@/components/admin/modal";
import { CopyPathButton } from "@/components/admin/reports/report-client";
import { Icon } from "@/components/icon";
import { FieldError } from "@/components/public/report/controls";
import { cn } from "@/lib/utils";
import { logInquiry } from "@/server/actions/inquiries";
import ko from "../../../messages/ko.json";

const t = ko.admin.inquiry;
const CHANNELS = ["phone", "visit", "message", "other"] as const;

/** [문의 기록] (A-02, A-07 서랍). With `reportId` the inquiry is tied to that report. */
export function InquiryButton({ reportId, className }: { reportId?: string; className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn("flex h-11 items-center justify-center gap-1.5 rounded-ui-sm border border-line-strong bg-surface px-3.5 text-button font-bold text-ink", className)}
      >
        <Icon name="phone" size={16} />
        {t.title}
      </button>
      {open ? <InquiryDialog reportId={reportId ?? null} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

/** A-10: channel (default phone), contact when no report is linked, one-line memo. Aim: 10 seconds. */
function InquiryDialog({ reportId, onClose }: { reportId: string | null; onClose: () => void }) {
  const [channel, setChannel] = useState<(typeof CHANNELS)[number]>("phone");
  const [contact, setContact] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ linkedPath: string | null; matched: boolean } | null>(null);
  const [pending, startTransition] = useTransition();

  const save = () =>
    startTransition(async () => {
      if (!reportId && !contact.trim()) {
        setError(t.needContact);
        return;
      }
      const result = await logInquiry({ channel, reportId, contact: reportId ? null : contact, note: note || null });
      if (result.ok) setDone(result.data);
      else setError(result.error === "invalid_input" ? t.needContact : t.failed);
    });

  if (done) {
    return (
      <Modal title={t.title} onClose={onClose}>
        <p role="status" className="flex items-center gap-2 text-body font-bold text-ink">
          <span className="flex size-7 items-center justify-center rounded-ui-pill bg-ok-bg text-ok">
            <Icon name="check" size={16} />
          </span>
          {t.saved}
        </p>
        {!done.matched ? <p className="text-desc text-ink-muted">{t.noReport}</p> : null}
        <div className="flex flex-wrap justify-end gap-2">
          {done.linkedPath ? <CopyPathButton path={done.linkedPath} label={t.copyLink} copiedLabel={t.copied} /> : null}
          {!done.matched ? (
            <Link href="/admin/reports/new" className="flex h-11 items-center rounded-ui-sm border border-line-strong bg-surface px-4 text-button font-bold text-ink">
              {t.toProxy}
            </Link>
          ) : null}
          <button type="button" onClick={onClose} className="flex h-11 items-center rounded-ui-sm bg-brand px-4 text-button font-bold text-on-brand">
            {t.close}
          </button>
        </div>
      </Modal>
    );
  }

  const field = "rounded-ui-sm border-[1.5px] border-line-strong bg-surface px-3.5 text-body font-normal text-ink outline-none placeholder:text-ink-muted focus-visible:border-brand";
  return (
    <Modal title={t.title} onClose={onClose}>
      <div role="radiogroup" aria-label={t.channel} className="flex flex-col gap-2">
        <span className="text-label font-bold text-ink">{t.channel}</span>
        <div className="flex flex-wrap gap-1.5">
          {CHANNELS.map((c) => (
            <button key={c} type="button" role="radio" aria-checked={channel === c} onClick={() => setChannel(c)} className={cn("flex h-9 items-center rounded-ui-pill border px-3 text-label font-bold", channel === c ? "border-brand bg-blush text-blush-ink" : "border-line bg-surface text-ink")}>
              {t.channels[c]}
            </button>
          ))}
        </div>
      </div>
      {reportId ? null : (
        <label className="flex flex-col gap-2 text-label font-bold text-ink">
          {t.contact}
          <input value={contact} maxLength={254} inputMode="email" placeholder={t.contactPlaceholder} onChange={(e) => setContact(e.target.value)} className={cn(field, "h-12")} />
        </label>
      )}
      <label className="flex flex-col gap-2 text-label font-bold text-ink">
        {t.note}
        <input value={note} maxLength={200} placeholder={t.notePlaceholder} onChange={(e) => setNote(e.target.value)} onKeyDown={(e) => e.key === "Enter" && save()} className={cn(field, "h-12")} />
      </label>
      <FieldError message={error} />
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onClose} className="flex h-11 items-center rounded-ui-sm border border-line-strong bg-surface px-4 text-button font-bold text-ink">
          {t.cancel}
        </button>
        <button type="button" disabled={pending} onClick={save} className="flex h-11 items-center gap-1.5 rounded-ui-sm bg-brand px-4 text-button font-bold text-on-brand disabled:opacity-85">
          {pending ? <Icon name="spinner" size={16} className="animate-spin" /> : null}
          {t.save}
        </button>
      </div>
    </Modal>
  );
}
