"use client";

import Image from "next/image";
import Link from "next/link";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { Icon } from "@/components/icon";
import { FieldError } from "@/components/public/report/controls";
import { isImageFile, resizeToJpeg } from "@/lib/image-resize";
import { cn } from "@/lib/utils";
import type { ClaimQuestionKey } from "@/lib/validation/claim";
import { submitClaim, submitProof, type ClaimState, type ProofState } from "@/server/actions/report-page";
import ko from "../../../../messages/ko.json";

const t = ko.public.claim;

/** P-05 questions, one optional photo and [확인 요청하기] (Figma 32:254). */
export function ClaimForm({ token, candidateId, questions }: { token: string; candidateId: string; questions: ClaimQuestionKey[] }) {
  const [state, formAction] = useActionState<ClaimState, FormData>(submitClaim.bind(null, token, candidateId), null);
  const [answers, setAnswers] = useState<Partial<Record<ClaimQuestionKey, string>>>({});
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [pending, startTransition] = useTransition();
  const honeypot = useRef<HTMLInputElement>(null);
  const hasAnswer = Object.values(answers).some((a) => a?.trim());

  if (state && (state.error === "active_exists" || state.error === "limit" || state.error === "not_available")) {
    return <ClaimBlocked token={token} reason={state.error} />;
  }

  const submit = () => {
    const fd = new FormData();
    fd.set("answers", JSON.stringify(answers));
    if (photo) fd.set("photo", photo.file);
    if (honeypot.current?.value) fd.set("website", honeypot.current.value);
    startTransition(() => formAction(fd));
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (hasAnswer && !pending) submit();
      }}
      className="flex flex-col gap-3.5"
    >
      {/* Honeypot: hidden from people, bots fill it in. */}
      <input ref={honeypot} type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden className="absolute -left-[9999px] size-px opacity-0" />
      {questions.map((key) => (
        <label key={key} className="flex flex-col gap-2">
          <span className="text-body leading-[1.5] font-bold text-ink">{t.questions[key]}</span>
          <textarea
            value={answers[key] ?? ""}
            maxLength={300}
            rows={3}
            placeholder={t.answerPlaceholder}
            onChange={(e) => setAnswers((a) => ({ ...a, [key]: e.target.value }))}
            className="min-h-[84px] w-full resize-none rounded-ui-sm border-[1.5px] border-line-strong bg-surface px-3.5 py-3 text-input leading-[1.55] text-ink outline-none placeholder:text-ink-muted focus-visible:border-brand focus-visible:ring-3 focus-visible:ring-brand/20"
          />
        </label>
      ))}

      <PhotoSlot photo={photo} onChange={setPhoto} />

      <FieldError message={state?.error === "answer_required" ? t.answerRequired : state ? t.failed : null} />
      <button
        type="submit"
        disabled={!hasAnswer || pending}
        aria-disabled={!hasAnswer || pending}
        className={cn("flex h-[52px] w-full items-center justify-center gap-2 rounded-ui-md bg-brand text-button-lg font-bold text-on-brand", !hasAnswer && "opacity-40", pending && "opacity-85")}
      >
        {pending ? <Icon name="spinner" size={18} className="animate-spin" /> : null}
        {pending ? t.sending : t.submit}
      </button>
    </form>
  );
}

/** P-04 추가 증빙 요청 (Figma 32:218): the facility's request, an answer, one optional photo. */
export function ProofForm({ token, candidateId }: { token: string; candidateId: string }) {
  const s = ko.public.status;
  const [state, formAction] = useActionState<ProofState, FormData>(submitProof.bind(null, token, candidateId), null);
  const [reply, setReply] = useState("");
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [pending, startTransition] = useTransition();
  const ready = reply.trim().length > 0;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!ready || pending) return;
        const fd = new FormData();
        fd.set("reply", reply);
        if (photo) fd.set("photo", photo.file);
        startTransition(() => formAction(fd));
      }}
      className="flex flex-col gap-3.5"
    >
      <label className="flex flex-col gap-2">
        <span className="text-body leading-[1.5] font-bold text-ink">{s.proofAnswer}</span>
        <textarea
          value={reply}
          maxLength={500}
          rows={3}
          placeholder={t.answerPlaceholder}
          onChange={(e) => setReply(e.target.value)}
          className="min-h-[84px] w-full resize-none rounded-ui-sm border-[1.5px] border-line-strong bg-surface px-3.5 py-3 text-input leading-[1.55] text-ink outline-none placeholder:text-ink-muted focus-visible:border-brand focus-visible:ring-3 focus-visible:ring-brand/20"
        />
      </label>
      <PhotoSlot photo={photo} onChange={setPhoto} />
      <FieldError message={state?.error === "reply_required" ? s.proofRequired : state ? s.actionFailed : null} />
      <button
        type="submit"
        disabled={!ready || pending}
        className={cn("flex h-[52px] w-full items-center justify-center gap-2 rounded-ui-md bg-brand text-button-lg font-bold text-on-brand", !ready && "opacity-40", pending && "opacity-85")}
      >
        {pending ? <Icon name="spinner" size={18} className="animate-spin" /> : null}
        {s.proofSubmit}
      </button>
    </form>
  );
}

type Photo = { file: File; url: string };

/** One optional photo: a 72px preview slot, or the dashed [+] slot (Figma "photo-attach"). */
function PhotoSlot({ photo, onChange }: { photo: Photo | null; onChange: (p: Photo | null) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const current = useRef<string | null>(null);
  useEffect(() => () => {
    if (current.current) URL.revokeObjectURL(current.current);
  }, []);

  const replace = (next: Photo | null) => {
    if (current.current) URL.revokeObjectURL(current.current);
    current.current = next?.url ?? null;
    onChange(next);
  };
  const pick = async (file: File | undefined) => {
    if (!file || !isImageFile(file)) return;
    const resized = await resizeToJpeg(file);
    replace({ file: resized, url: URL.createObjectURL(resized) });
  };

  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-label font-bold text-ink">{t.photo}</p>
      <p className="text-caption font-medium text-ink-muted">{t.photoHint}</p>
      <div className="flex gap-2">
        {photo ? (
          <button type="button" onClick={() => replace(null)} aria-label={t.photoRemove} className="relative size-[72px] overflow-hidden rounded-ui-sm bg-neutral-bg">
            <Image src={photo.url} alt="" fill unoptimized className="object-cover" />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => input.current?.click()}
            aria-label={t.photoAdd}
            className="flex size-[72px] items-center justify-center rounded-ui-sm border-[1.5px] border-dashed border-line-strong bg-surface"
          >
            <Icon name="plus-muted" size={22} />
          </button>
        )}
      </div>
      <input ref={input} type="file" accept="image/*" className="sr-only" tabIndex={-1} onChange={(e) => pick(e.target.files?.[0])} />
    </div>
  );
}

/** Figma 32:432 / 32:446: the request cannot be made, with a way back to P-04. */
export function ClaimBlocked({ token, reason }: { token: string; reason: "active_exists" | "limit" | "not_available" }) {
  const text = reason === "active_exists" ? t.activeExists : reason === "limit" ? t.limit : t.notAvailable;
  return (
    <section role="status" className="flex flex-col items-center gap-2.5 pt-20 text-center">
      <Image src="/brand/mascot-curious.png" alt="" width={170} height={129} className="h-[129px] w-[170px] object-contain" />
      <p className="text-section leading-[1.4] font-bold tracking-[-0.01em] text-ink">{text}</p>
      <Link href={`/r/${token}`} className="flex h-11 items-center rounded-ui-sm border border-line-strong bg-surface px-4 text-button font-bold text-ink">
        {t.toStatus}
      </Link>
    </section>
  );
}
