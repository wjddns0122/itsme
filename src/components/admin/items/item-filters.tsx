"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { Icon } from "@/components/icon";
import { ITEM_PERIODS, ITEM_SORTS, ITEM_STATUSES, itemListHref, type ItemListQuery } from "@/lib/items/filters";
import { CATEGORY_GROUPS } from "@/lib/validation/constants";
import ko from "../../../../messages/ko.json";

const t = ko.admin.items;

/** 상태 · 분류 · 기간 · 정렬 dropdowns (Figma A-04). Each change rewrites the URL. */
export function ItemFilters({ query }: { query: ItemListQuery }) {
  const router = useRouter();
  const go = (patch: Partial<ItemListQuery>) => router.push(itemListHref(query, patch));

  return (
    <div className="flex flex-wrap items-center gap-2">
      <FilterSelect label={t.filterStatus} value={query.status ?? ""} onChange={(v) => go({ status: (v || null) as ItemListQuery["status"] })}>
        <option value="">{t.all}</option>
        {ITEM_STATUSES.map((s) => (
          <option key={s} value={s}>
            {ko.itemStatus[s]}
          </option>
        ))}
      </FilterSelect>
      <FilterSelect label={t.filterCategory} value={query.group ?? ""} onChange={(v) => go({ group: v || null })}>
        <option value="">{t.all}</option>
        {CATEGORY_GROUPS.map((g) => (
          <option key={g.group} value={g.group}>
            {g.label}
          </option>
        ))}
      </FilterSelect>
      <FilterSelect label={t.filterPeriod} value={query.period} onChange={(v) => go({ period: v as ItemListQuery["period"] })}>
        {ITEM_PERIODS.map((p) => (
          <option key={p} value={p}>
            {t.periods[p]}
          </option>
        ))}
      </FilterSelect>
      <span className="flex-1" />
      <FilterSelect label={t.sort} value={query.sort} onChange={(v) => go({ sort: v as ItemListQuery["sort"] })}>
        {ITEM_SORTS.map((s) => (
          <option key={s} value={s}>
            {t.sorts[s]}
          </option>
        ))}
      </FilterSelect>
    </div>
  );
}

/** Looks like Figma's "상태: 전체 ⌄" button; a native select underneath for keyboards and phones. Shared with A-07. */
export function FilterSelect({ label, value, onChange, children }: { label: string; value: string; onChange: (v: string) => void; children: ReactNode }) {
  return (
    <label className="relative flex h-10 items-center gap-1 rounded-ui-sm border border-line bg-surface pr-9 pl-3 text-label font-bold text-ink">
      <span>{label}:</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="appearance-none bg-transparent font-bold outline-none">
        {children}
      </select>
      <span className="pointer-events-none absolute right-3">
        <Icon name="chevron-down" size={18} />
      </span>
    </label>
  );
}
