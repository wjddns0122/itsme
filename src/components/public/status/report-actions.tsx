"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { FieldError } from "@/components/public/report/controls";
import { cancelReport, dismissCandidate } from "@/server/actions/report-page";
import ko from "../../../../messages/ko.json";

const t = ko.public.status;
const buttonBase = "flex h-11 flex-1 items-center justify-center rounded-ui-sm px-4 text-button font-bold disabled:opacity-60";

/** [내 물건 같아요] [아니에요] under a candidate (Figma "CandidateCard" actions). */
export function CandidateActions({ token, candidateId }: { token: string; candidateId: string }) {
  const [pending, startTransition] = useTransition();
  const [failed, setFailed] = useState(false);

  const dismiss = () =>
    startTransition(async () => {
      const result = await dismissCandidate(token, candidateId);
      setFailed(!result.ok);
    });

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        {/* Ownership check request is P-05 (FL-040). */}
        <a href={`/r/${token}/claim/${candidateId}`} className={`${buttonBase} bg-brand text-on-brand`}>
          {t.claim}
        </a>
        <button type="button" onClick={dismiss} disabled={pending} className={`${buttonBase} border border-line-strong bg-surface text-ink`}>
          {t.dismiss}
        </button>
      </div>
      <FieldError message={failed ? t.actionFailed : null} />
    </div>
  );
}

/** [신고 취소] with an inline confirmation instead of a browser dialog. */
export function CancelReport({ token }: { token: string }) {
  const [confirming, setConfirming] = useState(false);
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();

  const cancel = () =>
    startTransition(async () => {
      const result = await cancelReport(token);
      setFailed(!result.ok);
      if (result.ok) setConfirming(false);
    });

  if (!confirming) {
    return (
      <button type="button" onClick={() => setConfirming(true)} className="min-h-11 px-3 text-desc text-ink-muted underline">
        {t.cancel}
      </button>
    );
  }

  return (
    <div role="alertdialog" aria-label={t.cancel} className="flex w-full flex-col gap-2.5 rounded-ui-md border border-line bg-surface p-3.5">
      <p className="text-desc text-ink">{t.cancelConfirm}</p>
      <div className="flex gap-2">
        <button type="button" onClick={cancel} disabled={pending} className={`${buttonBase} bg-brand text-on-brand`}>
          {t.cancelYes}
        </button>
        <button type="button" onClick={() => setConfirming(false)} className={`${buttonBase} border border-line-strong bg-surface text-ink`}>
          {t.cancelNo}
        </button>
      </div>
      <FieldError message={failed ? t.actionFailed : null} />
    </div>
  );
}

/** While candidates are being searched, re-fetch the page every 5 seconds (FL-023). */
export function AutoRefresh({ everyMs }: { everyMs: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = window.setInterval(() => router.refresh(), everyMs);
    return () => window.clearInterval(id);
  }, [router, everyMs]);
  return null;
}

/** "링크 복사": copies the report page address without ?new=1. */
export function CopyLinkButton() {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    const url = new URL(window.location.href);
    url.search = "";
    try {
      await navigator.clipboard.writeText(url.toString());
      setCopied(true);
    } catch {
      // Clipboard blocked: the address bar still has the link.
      setCopied(false);
    }
  };
  return (
    <button type="button" onClick={copy} className="flex h-11 shrink-0 items-center rounded-ui-sm border border-line-strong bg-surface px-4 text-button font-bold text-ink">
      {copied ? t.copied : t.copyLink}
    </button>
  );
}
