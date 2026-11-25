import type { ReactNode } from "react";
import { AppIcon } from "@/components/app-icon";
import ko from "../../../messages/ko.json";

/**
 * Public mobile-first column (360px design, centered on wider screens) with the Figma "TopBar".
 * `footer` sits at the bottom of the screen when the content is short.
 */
export function PublicShell({ children, footer, topRight }: { children: ReactNode; footer?: string; topRight?: ReactNode }) {
  return (
    <main className="mx-auto flex w-full max-w-[480px] flex-1 flex-col bg-canvas">
      <header className="flex items-center justify-between gap-3 px-4 py-3">
        <span className="flex items-center gap-1.5">
          <AppIcon size="sm" />
          <span className="font-brand text-character text-ink">{ko.app.name}</span>
        </span>
        {topRight ? <span className="min-w-0 truncate text-caption font-medium text-ink-muted">{topRight}</span> : null}
      </header>
      <div className="flex flex-1 flex-col px-4 pt-2 pb-6">
        {children}
        {footer ? <p className="mt-auto pt-6 text-center text-caption font-medium text-ink-muted">{footer}</p> : null}
      </div>
    </main>
  );
}
