"use client";

import { useState, useTransition } from "react";
import { Modal } from "@/components/admin/modal";
import { Icon } from "@/components/icon";
import { FieldError } from "@/components/public/report/controls";
import { cn } from "@/lib/utils";
import { reviewClaim } from "@/server/actions/candidates";
import ko from "../../../../messages/ko.json";

const t = ko.admin.claims;
const d = t.dialogs;

type Decision = "approve" | "request_proof" | "hold" | "reject";

const field =
  "w-full rounded-ui-sm border-[1.5px] border-line-strong bg-surface px-3.5 py-3 text-body text-ink outline-none placeholder:text-ink-muted focus-visible:border-brand";

/** [거절] [보류] [추가 증빙 요청] [승인] with their dialogs (Figma 30:5234 · 30:5331 · 30:5423 · 30:5513). */
export function ClaimDecisions({ id, subtitle, status, bring }: { id: string; subtitle: string; status: "claimed" | "needs_proof"; bring: string }) {
  const [open, setOpen] = useState<Decision | null>(null);
  const waitingForProof = status === "needs_proof";
  const button = "flex h-11 items-center rounded-ui-sm px-4 text-button font-bold";
  return (
    <>
      <div className="flex flex-wrap justify-end gap-2">
        <button type="button" onClick={() => setOpen("reject")} className={cn(button, "border border-danger bg-surface text-danger")}>
          {t.actions.reject}
        </button>
        <button type="button" onClick={() => setOpen("hold")} className={cn(button, "border border-line-strong bg-surface text-ink")}>
          {t.actions.hold}
        </button>
        {waitingForProof ? null : (
          <>
            <button type="button" onClick={() => setOpen("request_proof")} className={cn(button, "border border-line-strong bg-surface text-ink")}>
              {t.actions.requestProof}
            </button>
            <button type="button" onClick={() => setOpen("approve")} className={cn(button, "bg-brand text-on-brand")}>
              {t.actions.approve}
            </button>
          </>
        )}
      </div>
      {open ? <DecisionDialog id={id} decision={open} subtitle={subtitle} bring={bring} onClose={() => setOpen(null)} /> : null}
    </>
  );
}

function DecisionDialog({ id, decision, subtitle, bring, onClose }: { id: string; decision: Decision; subtitle: string; bring: string; onClose: () => void }) {
  const [message, setMessage] = useState("");
  const [proofs, setProofs] = useState(bring);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const title = { approve: d.approveTitle, request_proof: d.proofTitle, hold: d.holdTitle, reject: d.rejectTitle }[decision];
  const confirm = { approve: t.actions.approve, request_proof: t.actions.requestProof, hold: t.actions.hold, reject: t.actions.reject }[decision];
  const ready = decision === "request_proof" ? message.trim() !== "" : decision === "hold" ? note.trim() !== "" : true;

  const submit = () =>
    startTransition(async () => {
      const result =
        decision === "approve"
          ? await reviewClaim({ id, action: "approve", message: [message.trim(), proofs.trim() ? `${d.bring}: ${proofs.trim()}` : ""].filter(Boolean).join("\n"), note: null })
          : decision === "request_proof"
            ? await reviewClaim({ id, action: "request_proof", message, note: null })
            : decision === "hold"
              ? await reviewClaim({ id, action: "hold", message: null, note })
              : await reviewClaim({ id, action: "reject", message: null, note: note || null });
      if (result.ok) onClose();
      else setError(result.error === "conflict" ? d.conflict : d.failed);
    });

  return (
    <Modal title={title} subtitle={subtitle} onClose={onClose}>
      {decision === "approve" ? (
        <>
          <label className="flex flex-col gap-2 text-label font-bold text-ink">
            {d.pickup}
            <textarea value={message} maxLength={400} rows={3} onChange={(e) => setMessage(e.target.value)} className={cn(field, "min-h-[88px] font-normal")} />
          </label>
          <label className="flex flex-col gap-2 text-label font-bold text-ink">
            <span className="flex items-center gap-1.5">
              {d.bring}
              <span className="rounded-[6px] bg-neutral-bg px-1.5 text-caption font-bold text-neutral-ink">{d.auto}</span>
            </span>
            <input value={proofs} maxLength={80} onChange={(e) => setProofs(e.target.value)} className={cn(field, "h-12 py-0 font-normal")} />
          </label>
        </>
      ) : null}
      {decision === "request_proof" ? (
        <label className="flex flex-col gap-2 text-label font-bold text-ink">
          {d.proofMessage}
          <textarea value={message} maxLength={300} rows={3} placeholder={d.proofPlaceholder} onChange={(e) => setMessage(e.target.value)} className={cn(field, "min-h-[88px] font-normal")} />
        </label>
      ) : null}
      {decision === "hold" || decision === "reject" ? (
        <label className="flex flex-col gap-2 text-label font-bold text-ink">
          {decision === "hold" ? d.holdNote : d.rejectNote}
          <textarea value={note} maxLength={300} rows={3} onChange={(e) => setNote(e.target.value)} className={cn(field, "min-h-[88px] font-normal")} />
        </label>
      ) : null}
      {decision === "reject" ? <p className="rounded-ui-sm bg-neutral-bg px-3 py-2.5 text-desc text-neutral-ink">{d.rejectNotice}</p> : null}
      <FieldError message={error} />
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onClose} className="flex h-11 items-center rounded-ui-sm border border-line-strong bg-surface px-4 text-button font-bold text-ink">
          {d.cancel}
        </button>
        <button
          type="button"
          disabled={!ready || pending}
          onClick={submit}
          className={cn("flex h-11 items-center gap-1.5 rounded-ui-sm px-4 text-button font-bold disabled:opacity-60", decision === "reject" ? "bg-danger text-on-brand" : "bg-brand text-on-brand")}
        >
          {pending ? <Icon name="spinner" size={16} className="animate-spin" /> : null}
          {confirm}
        </button>
      </div>
    </Modal>
  );
}
