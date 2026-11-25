import type { ReactNode } from "react";
import { Icon } from "@/components/icon";
import { cn } from "@/lib/utils";

/** Toggle chip (Figma "Chip", Default / Selected). A real button so it works with keyboard and screen readers. */
export function ChipButton({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        "flex h-9 items-center rounded-ui-pill border px-3 text-label font-bold whitespace-nowrap",
        selected ? "border-brand bg-blush text-blush-ink" : "border-line bg-surface text-ink",
      )}
    >
      {label}
    </button>
  );
}

export function FieldGroup({ label, optionalLabel, children, labelFor }: { label: string; optionalLabel?: string; children: ReactNode; labelFor?: string }) {
  const Label = labelFor ? "label" : "p";
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={labelFor} className="text-label font-bold text-ink">
        {label}
        {optionalLabel ? <span className="text-ink-muted"> {optionalLabel}</span> : null}
      </Label>
      {children}
    </div>
  );
}

export function ChipRow({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-1.5">
      {children}
    </div>
  );
}

/** Checkbox drawn like Figma's red rounded box; the native input stays for accessibility. */
export function CheckBox({ checked, onChange, children, invalid }: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode; invalid?: boolean }) {
  return (
    <label className="flex cursor-pointer items-start gap-2">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} aria-invalid={invalid || undefined} className="peer sr-only" />
      <span
        aria-hidden
        className={cn(
          "mt-px flex size-[22px] shrink-0 items-center justify-center rounded-[7px] border-[1.5px] peer-focus-visible:ring-3 peer-focus-visible:ring-brand/30",
          checked ? "border-brand bg-brand" : invalid ? "border-danger bg-surface" : "border-line-strong bg-surface",
        )}
      >
        {checked ? <Icon name="check" size={14} /> : null}
      </span>
      <span className="min-w-0 flex-1">{children}</span>
    </label>
  );
}

export function FieldError({ id, message }: { id?: string; message: string | null }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="flex items-center gap-1.5 text-label font-bold text-danger">
      <Icon name="alert-circle" size={16} />
      {message}
    </p>
  );
}

export const inputClass =
  "w-full rounded-ui-sm border-[1.5px] border-line-strong bg-surface px-3.5 text-body text-ink outline-none placeholder:text-ink-muted focus-visible:border-brand focus-visible:ring-3 focus-visible:ring-brand/20 aria-invalid:border-danger";
