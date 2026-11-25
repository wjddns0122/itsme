"use client";

import { useState, useTransition, type ReactNode } from "react";
import { CopyPathButton } from "@/components/admin/reports/report-client";
import { Icon } from "@/components/icon";
import { useOrigin } from "@/components/use-origin";
import { CheckBox, FieldError } from "@/components/public/report/controls";
import { cn } from "@/lib/utils";
import { FACILITY_LIMITS, FACILITY_TYPES, type FacilitySettingsInput } from "@/lib/validation/facility";
import { updateFacility } from "@/server/actions/facility";
import ko from "../../../../messages/ko.json";

const t = ko.admin.settings;
const field =
  "w-full rounded-ui-sm border-[1.5px] border-line-strong bg-surface px-3.5 text-body text-ink outline-none placeholder:text-ink-muted focus-visible:border-brand disabled:bg-neutral-bg";

/** A-08 시설 설정 (Figma 23:2971): facility info and areas, public page, ready-to-paste texts. */
export function SettingsForm({ initial, slug, canEdit }: { initial: FacilitySettingsInput; slug: string; canEdit: boolean }) {
  const [form, setForm] = useState(initial);
  const [newArea, setNewArea] = useState("");
  const [status, setStatus] = useState<"idle" | "saved" | "failed" | "owner">(canEdit ? "idle" : "owner");
  const [pending, startTransition] = useTransition();
  const set = <K extends keyof FacilitySettingsInput>(key: K, value: FacilitySettingsInput[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setStatus((s) => (s === "owner" ? s : "idle"));
  };
  const pagePath = `/f/${slug}`;

  const addArea = () => {
    const name = newArea.trim();
    if (!name || form.areas.includes(name) || form.areas.length >= FACILITY_LIMITS.areas) return;
    set("areas", [...form.areas, name]);
    setNewArea("");
  };
  const moveArea = (i: number, by: -1 | 1) => {
    const next = [...form.areas];
    const j = i + by;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    set("areas", next);
  };
  const save = () =>
    startTransition(async () => {
      const result = await updateFacility(form);
      setStatus(result.ok ? "saved" : result.error === "unauthorized" ? "owner" : "failed");
    });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <Card title={t.info} className="flex-[1.6]">
          <fieldset disabled={!canEdit} className="flex flex-col gap-3.5">
            <Grid>
              <Text label={t.name} value={form.name} max={FACILITY_LIMITS.name} onChange={(v) => set("name", v)} />
              <Text label={t.contactPhone} value={form.contactPhone ?? ""} max={FACILITY_LIMITS.short} onChange={(v) => set("contactPhone", v)} type="tel" />
              <Text label={t.region} value={form.region ?? ""} max={FACILITY_LIMITS.short} onChange={(v) => set("region", v)} />
              <Text label={t.address} value={form.address ?? ""} max={FACILITY_LIMITS.short * 2} onChange={(v) => set("address", v)} />
              <label className="flex flex-col gap-2 text-label font-bold text-ink">
                {t.type}
                <select value={form.type} onChange={(e) => set("type", e.target.value as FacilitySettingsInput["type"])} className={cn(field, "h-12 font-normal")}>
                  {FACILITY_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {ko.facilityTypes[type]}
                    </option>
                  ))}
                </select>
              </label>
              <Text label={t.homepage} value={form.homepageUrl ?? ""} max={200} onChange={(v) => set("homepageUrl", v)} type="url" />
            </Grid>
            <Area label={t.intro} value={form.intro ?? ""} max={FACILITY_LIMITS.intro} onChange={(v) => set("intro", v)} />
            <Grid>
              <Text label={t.hours} value={form.hours ?? ""} max={FACILITY_LIMITS.short} onChange={(v) => set("hours", v)} />
              <label className="flex flex-col gap-2 text-label font-bold text-ink">
                {t.transferDays}
                <input
                  type="number"
                  inputMode="numeric"
                  min={FACILITY_LIMITS.transferMin}
                  max={FACILITY_LIMITS.transferMax}
                  value={form.transferDays}
                  onChange={(e) => set("transferDays", Number(e.target.value))}
                  className={cn(field, "h-12 font-normal")}
                />
                <span className="text-caption font-medium text-ink-muted">{t.transferHint}</span>
              </label>
              <Text label={t.deskLocation} value={form.deskLocation ?? ""} max={FACILITY_LIMITS.short} onChange={(v) => set("deskLocation", v)} />
            </Grid>
            <Area label={t.pickupGuide} value={form.pickupGuide ?? ""} max={FACILITY_LIMITS.guide} onChange={(v) => set("pickupGuide", v)} />

            <div className="flex flex-col gap-2">
              <span className="text-label font-bold text-ink">{t.areas}</span>
              <ul className="overflow-hidden rounded-ui-md border border-line">
                {form.areas.map((area, i) => (
                  <li key={area} className="flex items-center gap-2 border-b border-line px-3 py-1.5 last:border-b-0">
                    <span className="flex flex-col">
                      <button type="button" aria-label={t.moveUp.replace("{name}", area)} onClick={() => moveArea(i, -1)} className="h-5 px-1 text-caption text-ink-muted">▲</button>
                      <button type="button" aria-label={t.moveDown.replace("{name}", area)} onClick={() => moveArea(i, 1)} className="h-5 px-1 text-caption text-ink-muted">▼</button>
                    </span>
                    <span className="min-w-0 flex-1 truncate text-body text-ink">{area}</span>
                    <button type="button" aria-label={t.removeArea.replace("{name}", area)} onClick={() => set("areas", form.areas.filter((a) => a !== area))} className="flex size-11 items-center justify-center text-section text-ink-muted">
                      ✕
                    </button>
                  </li>
                ))}
                <li className="flex items-center gap-2 px-3 py-2">
                  <input
                    value={newArea}
                    maxLength={FACILITY_LIMITS.area}
                    placeholder={t.areaPlaceholder}
                    aria-label={t.areaPlaceholder}
                    onChange={(e) => setNewArea(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addArea();
                      }
                    }}
                    className={cn(field, "h-11 flex-1")}
                  />
                  <button type="button" onClick={addArea} className="flex h-11 items-center gap-1 px-2 text-label font-bold text-brand">
                    + {t.addArea}
                  </button>
                </li>
              </ul>
            </div>
          </fieldset>
          <FieldError message={status === "failed" ? t.failed : status === "owner" ? t.ownerOnly : null} />
          <div className="flex items-center justify-end gap-3">
            {status === "saved" ? (
              <span role="status" className="text-label font-bold text-ok">
                {t.saved}
              </span>
            ) : null}
            <button type="button" disabled={!canEdit || pending} onClick={save} className="flex h-11 items-center gap-1.5 rounded-ui-sm bg-brand px-4 text-button font-bold text-on-brand disabled:opacity-60">
              {pending ? <Icon name="spinner" size={16} className="animate-spin" /> : null}
              {t.save}
            </button>
          </div>
        </Card>

        <Card title={t.public} className="flex-1">
          <div className="flex flex-col gap-2">
            <span className="text-label font-bold text-ink">{t.pageUrl}</span>
            <PathField path={pagePath} />
          </div>
          <CheckBox checked={form.isListed} onChange={(v) => canEdit && set("isListed", v)}>
            <span className="text-desc text-ink">{t.listed}</span>
          </CheckBox>
        </Card>
      </div>

      <Card title={t.share}>
        <ShareRow label={t.homepageLink}>
          <PathField path={pagePath} />
        </ShareRow>
        <ShareRow label={t.smsText}>
          <TextCopy text={t.smsTemplate.replace("{name}", form.name)} withPath={pagePath} />
        </ShareRow>
        <ShareRow label={t.phoneLine}>
          <TextCopy text={t.phoneTemplate} />
        </ShareRow>
        <div className="flex flex-col gap-1">
          <span className="text-label font-bold text-ink">{t.posterPlaces}</span>
          <span className="text-body text-ink">{t.posterPlacesValue}</span>
        </div>
      </Card>
    </div>
  );
}

function Card({ title, className, children }: { title: string; className?: string; children: ReactNode }) {
  return (
    <section className={cn("flex min-w-0 flex-col gap-3.5 rounded-ui-md border border-line bg-surface p-5", className)}>
      <h2 className="text-section font-bold tracking-[-0.01em] text-ink">{title}</h2>
      {children}
    </section>
  );
}

function Grid({ children }: { children: ReactNode }) {
  return <div className="grid gap-3.5 sm:grid-cols-2">{children}</div>;
}

function Text({ label, value, max, onChange, type = "text" }: { label: string; value: string; max: number; onChange: (v: string) => void; type?: string }) {
  return (
    <label className="flex flex-col gap-2 text-label font-bold text-ink">
      {label}
      <input type={type} value={value} maxLength={max} onChange={(e) => onChange(e.target.value)} className={cn(field, "h-12 font-normal")} />
    </label>
  );
}

function Area({ label, value, max, onChange }: { label: string; value: string; max: number; onChange: (v: string) => void }) {
  return (
    <label className="flex flex-col gap-2 text-label font-bold text-ink">
      {label}
      <textarea value={value} maxLength={max} rows={2} onChange={(e) => onChange(e.target.value)} className={cn(field, "min-h-[64px] py-3 font-normal")} />
    </label>
  );
}

function ShareRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-label font-bold text-ink">{label}</span>
      {children}
    </div>
  );
}

/** Read-only absolute link with [복사]; the origin is only known in the browser. */
function PathField({ path }: { path: string }) {
  const origin = useOrigin();
  return (
    <div className="flex gap-2">
      <input readOnly value={`${origin}${path}`} aria-label={t.pageUrl} onFocus={(e) => e.currentTarget.select()} className={cn(field, "h-12 min-w-0 flex-1")} />
      <CopyPathButton path={path} label={t.copy} copiedLabel={t.copied} />
    </div>
  );
}

function TextCopy({ text, withPath }: { text: string; withPath?: string }) {
  const origin = useOrigin();
  const [copied, setCopied] = useState(false);
  const full = withPath ? text.replace("{url}", `${origin}${withPath}`) : text;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(full);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };
  return (
    <div className="flex items-start gap-2">
      <p className="min-w-0 flex-1 rounded-ui-sm border-[1.5px] border-line-strong bg-surface px-3.5 py-3 text-body text-ink">{full}</p>
      <button type="button" onClick={copy} className="flex h-11 shrink-0 items-center rounded-ui-sm border border-line-strong bg-surface px-4 text-button font-bold text-ink">
        {copied ? t.copied : t.copy}
      </button>
    </div>
  );
}
