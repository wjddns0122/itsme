"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Icon } from "@/components/icon";
import { ChipButton, ChipRow, FieldError, FieldGroup, inputClass } from "@/components/public/report/controls";
import { cn } from "@/lib/utils";
import { REPORT_COLOR_CHIPS, REPORT_LIMITS, TIMES_OF_DAY, type ReportUpdateInput } from "@/lib/validation/report";
import { updateLostReport } from "@/server/actions/report-page";
import ko from "../../../../messages/ko.json";

const t = ko.public.edit;
const r = ko.public.report;

/** P-04 [신고 내용 보완하기]: the step-1 fields of P-03 on one screen, prefilled. */
export function ImproveForm({ token, initial }: { token: string; initial: ReportUpdateInput }) {
  const [form, setForm] = useState(initial);
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();
  const colors = form.colors ?? [];
  const toggleColor = (c: (typeof REPORT_COLOR_CHIPS)[number]) =>
    setForm((f) => {
      const list = f.colors ?? [];
      return { ...f, colors: list.includes(c) ? list.filter((x) => x !== c) : [...list, c].slice(-REPORT_LIMITS.colors) };
    });

  const save = () =>
    startTransition(async () => {
      const result = await updateLostReport(token, { ...form, brand: form.brand?.trim() || null, description: form.description.trim() });
      if (result && !result.ok) setFailed(true);
    });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
      className="flex flex-col gap-4"
    >
      <FieldGroup label={r.description} labelFor="improve-description">
        <textarea
          id="improve-description"
          value={form.description}
          maxLength={REPORT_LIMITS.description}
          rows={4}
          placeholder={r.descriptionPlaceholder}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          className={cn(inputClass, "min-h-[104px] py-3")}
        />
      </FieldGroup>
      <FieldGroup label={r.color}>
        <ChipRow label={r.color}>
          {REPORT_COLOR_CHIPS.map((c) => (
            <ChipButton key={c} label={c} selected={colors.includes(c)} onClick={() => toggleColor(c)} />
          ))}
        </ChipRow>
      </FieldGroup>
      <FieldGroup label={r.brand} labelFor="improve-brand">
        <input
          id="improve-brand"
          value={form.brand ?? ""}
          maxLength={REPORT_LIMITS.brand}
          placeholder={r.brandPlaceholder}
          onChange={(e) => setForm((f) => ({ ...f, brand: e.target.value }))}
          className={cn(inputClass, "h-12")}
        />
      </FieldGroup>
      <FieldGroup label={r.timeOfDay}>
        <ChipRow label={r.timeOfDay}>
          {TIMES_OF_DAY.map((time) => (
            <ChipButton key={time} label={r.times[time]} selected={form.lostTimeOfDay === time} onClick={() => setForm((f) => ({ ...f, lostTimeOfDay: f.lostTimeOfDay === time ? null : time }))} />
          ))}
          <ChipButton label={r.timeUnknown} selected={form.lostTimeOfDay === null} onClick={() => setForm((f) => ({ ...f, lostTimeOfDay: null }))} />
        </ChipRow>
      </FieldGroup>
      <FieldError message={failed ? t.failed : null} />
      <button type="submit" disabled={pending} className="flex h-[52px] w-full items-center justify-center gap-2 rounded-ui-md bg-brand text-button-lg font-bold text-on-brand disabled:opacity-85">
        {pending ? <Icon name="spinner" size={18} className="animate-spin" /> : null}
        {pending ? t.saving : t.save}
      </button>
      <Link href={`/r/${token}`} className="flex min-h-11 items-center justify-center text-desc text-ink-muted underline">
        {t.back}
      </Link>
    </form>
  );
}
