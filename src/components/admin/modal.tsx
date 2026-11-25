"use client";

import { useEffect, useRef, type ReactNode } from "react";

/** Centered dialog over a dimmed page (Figma A-06 대화상자, A-09). Escape and the backdrop close it. */
export function Modal({ title, subtitle, onClose, children }: { title: string; subtitle?: string; onClose: () => void; children: ReactNode }) {
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    panel.current?.querySelector<HTMLElement>("textarea, input, button")?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-ink/40 p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={panel} role="dialog" aria-modal="true" aria-label={title} className="flex max-h-[90dvh] w-full max-w-[452px] flex-col gap-4 overflow-y-auto rounded-ui-lg bg-surface p-6 shadow-pop">
        <div className="flex flex-col gap-1">
          <h2 className="text-section font-bold tracking-[-0.01em] text-ink">{title}</h2>
          {subtitle ? <p className="text-desc text-ink-muted">{subtitle}</p> : null}
        </div>
        {children}
      </div>
    </div>
  );
}
