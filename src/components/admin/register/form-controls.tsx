import type { ReactNode } from "react";
import { Icon } from "@/components/icon";
import { cn } from "@/lib/utils";

/** Field shell for A-03: AI-filled values get the light blue fill and a sparkle until edited. */
export const fieldClass = (aiFilled: boolean) =>
  cn(
    "w-full rounded-ui-sm border-[1.5px] border-line-strong px-3 text-body text-ink outline-none focus-visible:border-brand focus-visible:ring-3 focus-visible:ring-brand/20 aria-invalid:border-danger",
    aiFilled ? "bg-ai-fill pr-9" : "bg-surface",
  );

export function AiMark({ show, label }: { show: boolean; label: string }) {
  if (!show) return null;
  return (
    <span className="pointer-events-none absolute top-3.5 right-3" aria-label={label} role="img">
      <Icon name="sparkle" size={16} />
    </span>
  );
}

export function Field({ label, htmlFor, children, extra }: { label: string; htmlFor?: string; children: ReactNode; extra?: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
      <div className="flex items-center gap-1.5">
        <label htmlFor={htmlFor} className="text-label font-bold text-ink">
          {label}
        </label>
        {extra}
      </div>
      {children}
    </div>
  );
}

export function Tag({ tone, children }: { tone: "info" | "muted"; children: ReactNode }) {
  return (
    <span className={cn("rounded-[6px] px-1.5 py-px text-caption font-bold", tone === "info" ? "bg-info-bg text-info" : "bg-neutral-bg text-neutral-ink")}>
      {children}
    </span>
  );
}

/** On/off switch (Figma "Switch"); a real checkbox underneath. */
export function Switch({ checked, onChange, label, id }: { checked: boolean; onChange: (v: boolean) => void; label: string; id: string }) {
  return (
    <label htmlFor={id} className="relative inline-flex h-11 cursor-pointer items-center">
      <input id={id} type="checkbox" role="switch" aria-label={label} checked={checked} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
      <span className={cn("h-[26px] w-11 rounded-ui-pill transition-colors peer-focus-visible:ring-3 peer-focus-visible:ring-brand/30", checked ? "bg-brand" : "bg-track")} />
      <span className={cn("absolute top-1/2 size-5 -translate-y-1/2 rounded-ui-pill bg-surface shadow-sm transition-all", checked ? "left-[21px]" : "left-[3px]")} />
    </label>
  );
}

export function Banner({ tone, children }: { tone: "warn" | "info"; children: ReactNode }) {
  return (
    <p role="status" className={cn("rounded-ui-sm px-3.5 py-2.5 text-desc font-bold", tone === "warn" ? "bg-warn-bg text-butter-ink" : "bg-info-bg text-info")}>
      {children}
    </p>
  );
}
