"use client";

import Image from "next/image";
import { useActionState, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Icon } from "@/components/icon";
import { formatMonthDay } from "@/lib/dates";
import type { Color } from "@/lib/validation/constants";
import { cn } from "@/lib/utils";
import {
  REPORT_CATEGORY_CHIPS,
  REPORT_COLOR_CHIPS,
  REPORT_LIMITS,
  TIMES_OF_DAY,
  reportFieldErrors,
  stepOfError,
  type ReportFieldError,
} from "@/lib/validation/report";
import { createLostReport, type CreateReportState } from "@/server/actions/reports";
import ko from "../../../../messages/ko.json";
import { CheckBox, ChipButton, ChipRow, FieldError, FieldGroup, inputClass } from "./controls";
import { activeDatePreset, datePresetRange, draftToInput, emptyDraft, type DatePreset, type ReportDraft } from "./draft";

const t = ko.public.report;
type Step = 1 | 2 | 3;

type Props = { slug: string; areas: string[]; today: string };

/**
 * P-03 분실 신고, three steps in one form so values survive step changes. Steps use browser
 * history, so the back gesture goes to the previous step instead of leaving the form.
 */
export function ReportForm({ slug, areas, today }: Props) {
  const [draft, setDraft] = useState<ReportDraft>(() => emptyDraft(today));
  const [step, setStep] = useState<Step>(1);
  const [shownErrors, setShownErrors] = useState<ReportFieldError[]>([]);
  const startedAt = useRef<string | null>(null);

  const [state, formAction, pending] = useActionState<CreateReportState, FormData>(async (prev, formData) => {
    const result = await createLostReport(slug, prev, formData);
    if (result?.fields?.length) {
      setShownErrors(result.fields);
      setStep(Math.min(...result.fields.map(stepOfError)) as Step);
    }
    return result;
  }, null);

  useEffect(() => {
    startedAt.current = new Date().toISOString();
    const onPop = (e: PopStateEvent) => setStep(readStep(e.state));
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  // Takes a patch or a function of the latest draft, so quick taps never overwrite each other.
  const update: Update = (patch) => {
    setDraft((d) => ({ ...d, ...(typeof patch === "function" ? patch(d) : patch) }));
    setShownErrors([]);
  };

  const errorsFor = (s: Step) => reportFieldErrors(draftToInput(draft, null), today).filter((e) => stepOfError(e) === s);

  const goNext = () => {
    const errors = errorsFor(step);
    if (errors.length > 0) {
      setShownErrors(errors);
      return;
    }
    const next = (step + 1) as Step;
    window.history.pushState({ reportStep: next }, "");
    setStep(next);
    window.scrollTo({ top: 0 });
  };

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    if (step < 3) {
      e.preventDefault();
      goNext();
      return;
    }
    const errors = errorsFor(3);
    if (errors.length > 0) {
      e.preventDefault();
      setShownErrors(errors);
      return;
    }
    // Filled in at submit time so the start time is the moment the form opened, not a render.
    const payload = e.currentTarget.elements.namedItem("payload");
    if (payload instanceof HTMLInputElement) payload.value = JSON.stringify(draftToInput(draft, startedAt.current));
  };

  const message = (code: ReportFieldError) => (shownErrors.includes(code) ? t.errors[code] : null);
  const serverError = state && !state.fields?.length ? t.errors[state.error === "not_found" ? "not_found" : "internal"] : null;

  return (
    <form action={formAction} onSubmit={onSubmit} noValidate className="flex flex-col gap-3.5">
      <input type="hidden" name="payload" />
      {/* Honeypot: hidden from people, bots fill it in. */}
      <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden className="absolute -left-[9999px] size-px opacity-0" />

      <p className="text-caption font-bold text-ink-muted" aria-label={t.progressLabel.replace("{step}", String(step))}>
        <span className="text-brand">{step}</span>/3
      </p>

      {step === 1 ? <StepWhat draft={draft} update={update} message={message} /> : null}
      {step === 2 ? <StepWhen draft={draft} update={update} message={message} areas={areas} today={today} /> : null}
      {step === 3 ? <StepContact draft={draft} update={update} message={message} /> : null}

      <FieldError message={serverError} />

      <button
        type="submit"
        disabled={pending}
        aria-busy={pending}
        className="flex h-13 items-center justify-center gap-2 rounded-ui-md bg-brand text-button-lg font-bold text-on-brand disabled:opacity-85"
      >
        {pending ? <Icon name="spinner" size={18} className="animate-spin" /> : null}
        {step < 3 ? t.next : t.submit}
      </button>
    </form>
  );
}

function readStep(state: unknown): Step {
  const s = (state as { reportStep?: unknown } | null)?.reportStep;
  return s === 2 || s === 3 ? s : 1;
}

type Update = (patch: Partial<ReportDraft> | ((d: ReportDraft) => Partial<ReportDraft>)) => void;

type StepProps = {
  draft: ReportDraft;
  update: Update;
  message: (code: ReportFieldError) => string | null;
};

function StepHeading({ title, aside }: { title: string; aside?: ReactNode }) {
  return (
    <>
      <div className="flex items-end justify-between gap-3">
        <h1 className="text-question font-bold tracking-[-0.02em] text-ink">{title}</h1>
        {aside}
      </div>
      <p className="text-desc text-ink-muted">{t.hint}</p>
    </>
  );
}

function StepWhat({ draft, update, message }: StepProps) {
  const toggleColor = (c: Color) =>
    update((d) => ({
      colors: d.colors.includes(c) ? d.colors.filter((x) => x !== c) : [...d.colors, c].slice(-REPORT_LIMITS.colors),
      colorsUnknown: false,
    }));

  return (
    <>
      <StepHeading title={t.step1Title} />

      <FieldGroup label={t.category}>
        <ChipRow label={t.category}>
          {REPORT_CATEGORY_CHIPS.map((c) => (
            <ChipButton
              key={c.value}
              label={c.label}
              selected={draft.userCategory === c.value}
              onClick={() => update((d) => ({ userCategory: d.userCategory === c.value ? null : c.value }))}
            />
          ))}
        </ChipRow>
      </FieldGroup>

      <FieldGroup label={t.color}>
        <ChipRow label={t.color}>
          {REPORT_COLOR_CHIPS.map((c) => (
            <ChipButton key={c} label={c} selected={!draft.colorsUnknown && draft.colors.includes(c)} onClick={() => toggleColor(c)} />
          ))}
          <ChipButton label={t.unknown} selected={draft.colorsUnknown} onClick={() => update((d) => ({ colorsUnknown: !d.colorsUnknown, colors: [] }))} />
        </ChipRow>
      </FieldGroup>

      <FieldGroup label={t.brand}>
        <ChipRow label={t.brand}>
          <ChipButton label={t.brandKnown} selected={draft.brandKnown === true} onClick={() => update({ brandKnown: true })} />
          <ChipButton label={t.unknown} selected={draft.brandKnown === false} onClick={() => update({ brandKnown: false, brand: "" })} />
        </ChipRow>
        {draft.brandKnown ? (
          <input
            aria-label={t.brand}
            value={draft.brand}
            onChange={(e) => update({ brand: e.target.value })}
            maxLength={REPORT_LIMITS.brand}
            placeholder={t.brandPlaceholder}
            className={cn(inputClass, "h-11")}
          />
        ) : null}
      </FieldGroup>

      <FieldGroup label={t.description} optionalLabel={t.optional} labelFor="report-description">
        <div className="relative pt-14">
          <div className="rounded-ui-lg border-[1.5px] border-brand bg-surface px-3.5 pt-3.5 pb-2.5 shadow-[0_5px_0_0_var(--color-blush)]">
            <textarea
              id="report-description"
              value={draft.description}
              onChange={(e) => update({ description: e.target.value })}
              maxLength={REPORT_LIMITS.description}
              placeholder={t.descriptionPlaceholder}
              rows={3}
              aria-invalid={message("what_required") ? true : undefined}
              className="min-h-[72px] w-full resize-none bg-transparent text-input text-ink outline-none placeholder:text-ink-muted"
            />
          </div>
          <Image src="/brand/mascot-peek.png" alt="" width={150} height={65} className="pointer-events-none absolute top-0 right-3 h-[65px] w-[150px] object-contain" />
        </div>
      </FieldGroup>

      <FieldError message={message("what_required")} />
    </>
  );
}

function StepWhen({ draft, update, message, areas, today }: StepProps & { areas: string[]; today: string }) {
  const preset = activeDatePreset(draft, today);
  const presets: DatePreset[] = ["today", "yesterday", "last3Days"];
  const presetLabel: Record<DatePreset, string> = { today: t.today, yesterday: t.yesterday, last3Days: t.last3Days };

  return (
    <>
      <StepHeading title={t.step2Title} />

      <FieldGroup label={t.date}>
        <ChipRow label={t.date}>
          {presets.map((p) => (
            <ChipButton key={p} label={presetLabel[p]} selected={preset === p} onClick={() => update(datePresetRange(p, today))} />
          ))}
        </ChipRow>
        <div className={cn(inputClass, "flex h-11 items-center gap-2 px-3")} aria-invalid={message("date_invalid") ? true : undefined}>
          <input
            type="date"
            aria-label={t.dateFrom}
            value={draft.lostFrom}
            max={today}
            onChange={(e) => update({ lostFrom: e.target.value })}
            className="min-w-0 flex-1 bg-transparent text-body text-ink outline-none"
          />
          <span className="text-ink-muted">~</span>
          <input
            type="date"
            aria-label={t.dateTo}
            value={draft.lostTo}
            max={today}
            onChange={(e) => update({ lostTo: e.target.value })}
            className="min-w-0 flex-1 bg-transparent text-body text-ink outline-none"
          />
        </div>
        <p className="sr-only">
          {formatMonthDay(draft.lostFrom || today)} ~ {formatMonthDay(draft.lostTo || today)}
        </p>
        <FieldError message={message("date_invalid")} />
      </FieldGroup>

      <FieldGroup label={t.timeOfDay}>
        <ChipRow label={t.timeOfDay}>
          {TIMES_OF_DAY.map((time) => (
            <ChipButton key={time} label={t.times[time]} selected={draft.timeOfDay === time} onClick={() => update((d) => ({ timeOfDay: d.timeOfDay === time ? null : time }))} />
          ))}
          <ChipButton label={t.timeUnknown} selected={draft.timeOfDay === "unknown"} onClick={() => update((d) => ({ timeOfDay: d.timeOfDay === "unknown" ? null : "unknown" }))} />
        </ChipRow>
      </FieldGroup>

      {areas.length > 0 ? (
        <FieldGroup label={t.area}>
          <ChipRow label={t.area}>
            {areas.map((a) => (
              <ChipButton key={a} label={a} selected={!draft.areaUnknown && draft.area === a} onClick={() => update((d) => ({ area: d.area === a ? null : a, areaUnknown: false }))} />
            ))}
            <ChipButton label={t.unknown} selected={draft.areaUnknown} onClick={() => update((d) => ({ areaUnknown: !d.areaUnknown, area: null }))} />
          </ChipRow>
        </FieldGroup>
      ) : null}

      <div className="rounded-ui-sm border border-line bg-surface px-3.5 py-3 text-body text-ink">
        <CheckBox checked={draft.isRental} onChange={(v) => update({ isRental: v })}>
          {t.rental}
        </CheckBox>
      </div>
    </>
  );
}

function StepContact({ draft, update, message }: StepProps) {
  const contactError = message("contact_required");
  return (
    <>
      <StepHeading
        title={t.step3Title}
        aside={<Image src="/brand/mascot-laptop.png" alt="" width={86} height={71} className="h-[71px] w-[86px] object-contain" />}
      />

      <FieldGroup label={t.email} labelFor="report-email">
        <input
          id="report-email"
          type="email"
          inputMode="email"
          autoComplete="email"
          value={draft.email}
          onChange={(e) => update({ email: e.target.value })}
          placeholder={t.emailPlaceholder}
          aria-invalid={contactError || message("email_invalid") ? true : undefined}
          className={cn(inputClass, "h-[46px]")}
        />
        <FieldError message={message("email_invalid")} />
      </FieldGroup>

      <FieldGroup label={t.phone} labelFor="report-phone">
        <input
          id="report-phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          value={draft.phone}
          onChange={(e) => update({ phone: e.target.value })}
          placeholder={t.phonePlaceholder}
          aria-invalid={contactError || message("phone_invalid") ? true : undefined}
          className={cn(inputClass, "h-[46px]")}
        />
        <FieldError message={message("phone_invalid") ?? contactError} />
      </FieldGroup>

      <FieldGroup label={t.name} optionalLabel={t.optional} labelFor="report-name">
        <input
          id="report-name"
          autoComplete="name"
          value={draft.name}
          onChange={(e) => update({ name: e.target.value })}
          maxLength={REPORT_LIMITS.name}
          className={cn(inputClass, "h-[46px]")}
        />
      </FieldGroup>

      <FieldGroup label={t.secret} optionalLabel={t.optional} labelFor="report-secret">
        <input
          id="report-secret"
          value={draft.secret}
          onChange={(e) => update({ secret: e.target.value })}
          maxLength={REPORT_LIMITS.secret}
          className={cn(inputClass, "h-[46px]")}
        />
        <p className="flex items-start gap-1.5 text-caption font-medium text-ink-muted">
          <Icon name="lock" size={14} className="mt-0.5" />
          {t.secretHint}
        </p>
      </FieldGroup>

      <div className="flex flex-col gap-2">
        <CheckBox checked={draft.consent} onChange={(v) => update({ consent: v })} invalid={Boolean(message("consent_required"))}>
          <span className="text-desc text-ink">{t.consent}</span>
        </CheckBox>
        <details className="pl-[30px] text-desc text-ink-muted">
          <summary className="cursor-pointer underline">{t.consentMore}</summary>
          <ul className="mt-1.5 flex list-disc flex-col gap-1 pl-4">
            {t.consentFull.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </details>
        <FieldError message={message("consent_required")} />
      </div>
    </>
  );
}
