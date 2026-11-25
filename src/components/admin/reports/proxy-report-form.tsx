"use client";

import Link from "next/link";
import { useState, useTransition, type ReactNode } from "react";
import { CopyPathButton } from "@/components/admin/reports/report-client";
import { Icon } from "@/components/icon";
import { CheckBox, ChipButton, ChipRow, FieldError, inputClass } from "@/components/public/report/controls";
import { cn } from "@/lib/utils";
import { REPORT_CATEGORY_CHIPS, type LostReportInput, type ReportFieldError } from "@/lib/validation/report";
import { createReportByAdmin } from "@/server/actions/reports";
import ko from "../../../../messages/ko.json";

const t = ko.admin.reports.new;
const r = ko.public.report;

type Form = {
  description: string;
  userCategory: string | null;
  lostFrom: string;
  lostTo: string;
  lostArea: string;
  email: string;
  phone: string;
  name: string;
  secret: string;
  consent: boolean;
};

/** A-07 대리 신고 접수: the P-03 fields on one screen, for reports taken by phone or at the desk. */
export function ProxyReportForm({ areas, today }: { areas: string[]; today: string }) {
  const [form, setForm] = useState<Form>({ description: "", userCategory: null, lostFrom: today, lostTo: today, lostArea: "", email: "", phone: "", name: "", secret: "", consent: false });
  const [startedAt] = useState(() => new Date().toISOString());
  const [errors, setErrors] = useState<ReportFieldError[]>([]);
  const [failed, setFailed] = useState(false);
  const [path, setPath] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((f) => ({ ...f, [key]: value }));
  const message = (e: ReportFieldError) => (errors.includes(e) ? r.errors[e] : null);

  const submit = () =>
    startTransition(async () => {
      const orNull = (v: string) => v.trim() || null;
      const input: LostReportInput = {
        userCategory: form.userCategory,
        colors: [],
        brand: null,
        description: form.description.trim(),
        lostFrom: form.lostFrom,
        lostTo: form.lostTo,
        lostTimeOfDay: null,
        lostArea: orNull(form.lostArea),
        isRental: false,
        contactName: orNull(form.name),
        contactEmail: orNull(form.email),
        contactPhone: orNull(form.phone),
        secretDetail: orNull(form.secret),
        consent: form.consent,
        reportStartedAt: startedAt,
      };
      const result = await createReportByAdmin(input);
      if (result.ok) {
        setPath(result.data.path);
        return;
      }
      setErrors(result.fields ?? []);
      setFailed(!result.fields?.length);
    });

  if (path) return <Done path={path} />;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="flex flex-col gap-5 rounded-ui-lg border border-line bg-surface p-6"
      noValidate
    >
      <Section title={t.what}>
        <label className="flex flex-col gap-2 text-label font-bold text-ink">
          {t.description}
          <textarea value={form.description} maxLength={500} rows={3} onChange={(e) => set("description", e.target.value)} className={cn(inputClass, "min-h-[88px] py-3 font-normal")} />
        </label>
        <ChipRow label={r.category}>
          {REPORT_CATEGORY_CHIPS.map((c) => (
            <ChipButton key={c.value} label={c.label} selected={form.userCategory === c.value} onClick={() => set("userCategory", form.userCategory === c.value ? null : c.value)} />
          ))}
        </ChipRow>
        <FieldError message={message("what_required")} />
      </Section>

      <Section title={t.when}>
        <div className="grid gap-3 sm:grid-cols-2">
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-label font-bold text-ink">{t.period}</legend>
            <div className="flex items-center gap-2">
              <input type="date" aria-label={t.from} value={form.lostFrom} max={today} onChange={(e) => set("lostFrom", e.target.value)} className={cn(inputClass, "h-12 min-w-0 flex-1")} />
              <span aria-hidden className="text-ink-muted">~</span>
              <input type="date" aria-label={t.to} value={form.lostTo} max={today} onChange={(e) => set("lostTo", e.target.value)} className={cn(inputClass, "h-12 min-w-0 flex-1")} />
            </div>
          </fieldset>
          <label className="flex flex-col gap-2 text-label font-bold text-ink">
            {t.area}
            <select value={form.lostArea} onChange={(e) => set("lostArea", e.target.value)} className={cn(inputClass, "h-12 font-normal")}>
              <option value="">{t.areaUnknown}</option>
              {areas.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </label>
        </div>
        <FieldError message={message("date_invalid")} />
      </Section>

      <Section title={t.contact}>
        <div className="grid gap-3 sm:grid-cols-3">
          <TextField label={r.email} type="email" value={form.email} placeholder={r.emailPlaceholder} onChange={(v) => set("email", v)} invalid={errors.includes("email_invalid")} />
          <TextField label={r.phone} type="tel" value={form.phone} placeholder={r.phonePlaceholder} onChange={(v) => set("phone", v)} invalid={errors.includes("phone_invalid")} />
          <TextField label={`${r.name} ${r.optional}`} value={form.name} onChange={(v) => set("name", v)} />
        </div>
        <FieldError message={message("contact_required") ?? message("email_invalid") ?? message("phone_invalid")} />
        <label className="flex flex-col gap-2 text-label font-bold text-ink">
          <span className="flex items-center gap-2">
            {r.secret}
            <span className="flex items-center gap-1 text-caption font-medium text-ink-muted">
              <Icon name="lock" size={14} />
              {t.secretHint}
            </span>
          </span>
          <input value={form.secret} maxLength={300} onChange={(e) => set("secret", e.target.value)} className={cn(inputClass, "h-12 font-normal")} />
        </label>
        <CheckBox checked={form.consent} onChange={(v) => set("consent", v)} invalid={errors.includes("consent_required")}>
          <span className="text-desc text-ink">{t.consent}</span>
          <span className="block text-caption font-medium text-ink-muted">{t.consentHint}</span>
        </CheckBox>
        <FieldError message={message("consent_required")} />
      </Section>

      {failed ? <FieldError message={t.failed} /> : null}
      <div className="flex justify-end gap-2">
        <Link href="/admin/reports" className="flex h-11 items-center rounded-ui-sm border border-line-strong bg-surface px-4 text-button font-bold text-ink">
          {t.cancel}
        </Link>
        <button type="submit" disabled={pending} className="flex h-11 items-center gap-1.5 rounded-ui-sm bg-brand px-4 text-button font-bold text-on-brand disabled:opacity-85">
          {pending ? <Icon name="spinner" size={16} className="animate-spin" /> : null}
          {t.submit}
        </button>
      </div>
    </form>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-section font-bold tracking-[-0.01em] text-ink">{title}</h2>
      {children}
    </section>
  );
}

function TextField({ label, value, onChange, type = "text", placeholder, invalid }: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string; invalid?: boolean }) {
  return (
    <label className="flex flex-col gap-2 text-label font-bold text-ink">
      {label}
      <input type={type} value={value} placeholder={placeholder} aria-invalid={invalid || undefined} onChange={(e) => onChange(e.target.value)} className={cn(inputClass, "h-12 font-normal")} />
    </label>
  );
}

/** Figma 25:4493: the link to read out on the phone or send by text. */
function Done({ path }: { path: string }) {
  const [origin] = useState(() => (typeof window === "undefined" ? "" : window.location.origin));
  return (
    <section className="flex flex-col items-center gap-4 rounded-ui-lg border border-line bg-surface px-6 py-8">
      <span className="flex size-14 items-center justify-center rounded-ui-pill bg-ok-bg text-ok">
        <Icon name="check" size={26} />
      </span>
      <p role="status" className="text-section font-bold text-ink">
        {t.done}
      </p>
      <div className="flex w-full flex-col gap-1.5">
        <label htmlFor="proxy-link" className="text-label font-bold text-ink">
          {t.link}
        </label>
        <div className="flex gap-2">
          <input id="proxy-link" readOnly value={`${origin}${path}`} className={cn(inputClass, "h-11 min-w-0 flex-1")} onFocus={(e) => e.currentTarget.select()} />
          <CopyPathButton path={path} label={t.copy} copiedLabel={t.copied} primary />
        </div>
        <p className="text-caption font-medium text-ink-muted">{t.linkHint}</p>
      </div>
      <Link href="/admin/reports" className="flex h-11 items-center rounded-ui-sm border border-line-strong bg-surface px-4 text-button font-bold text-ink">
        {t.toList}
      </Link>
    </section>
  );
}
