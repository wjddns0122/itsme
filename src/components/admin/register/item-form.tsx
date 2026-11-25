"use client";

import type { ReactNode } from "react";
import { Icon } from "@/components/icon";
import { ChipButton } from "@/components/public/report/controls";
import { CATEGORIES, COLORS, type CategoryCode, type Color } from "@/lib/validation/constants";
import { cn } from "@/lib/utils";
import ko from "../../../../messages/ko.json";
import { AiMark, Field, Switch, Tag, fieldClass } from "./form-controls";
import type { AiField, RegisterErrors, RegisterValues } from "./register-state";

const t = ko.admin.register;

type Props = {
  values: RegisterValues;
  aiFilled: ReadonlySet<AiField>;
  errors: RegisterErrors;
  areas: string[];
  onChange: <K extends keyof RegisterValues>(key: K, value: RegisterValues[K]) => void;
};

/** A-03 2단계 확인·수정 (Figma "form" card). */
export function ItemForm({ values, aiFilled, errors, areas, onChange }: Props) {
  const ai = (f: AiField) => aiFilled.has(f);
  const toggleColor = (c: Color) =>
    onChange("colors", values.colors.includes(c) ? values.colors.filter((x) => x !== c) : [...values.colors, c].slice(-5));

  return (
    <div className="flex flex-col gap-4 rounded-ui-md border border-line bg-surface p-5">
      <div className="flex flex-col gap-3 sm:flex-row">
        <Field label={t.category} htmlFor="item-category">
          <SelectBox id="item-category" aiFilled={ai("category")} invalid={errors.category} value={values.category} onChange={(v) => onChange("category", v as CategoryCode)}>
            <option value="" disabled>
              {t.categoryPlaceholder}
            </option>
            {CATEGORIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.label}
              </option>
            ))}
          </SelectBox>
          {errors.category ? <ErrorText text={t.errors.category_required} /> : null}
        </Field>
        <Field label={t.subcategory} htmlFor="item-subcategory">
          <div className="relative">
            <input id="item-subcategory" value={values.subcategory} maxLength={40} onChange={(e) => onChange("subcategory", e.target.value)} className={cn(fieldClass(ai("subcategory")), "h-11")} />
            <AiMark show={ai("subcategory")} label={t.aiFilledLabel} />
          </div>
        </Field>
      </div>

      <Field label={t.color}>
        <div role="group" aria-label={t.color} className={cn("flex flex-wrap gap-1.5", ai("colors") && "rounded-ui-sm bg-ai-fill p-1.5")}>
          {COLORS.map((c) => (
            <ChipButton key={c} label={c} selected={values.colors.includes(c)} onClick={() => toggleColor(c)} />
          ))}
        </div>
      </Field>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <Field label={t.brand} htmlFor="item-brand" extra={ai("brand") ? <Tag tone="info">{t.guessed}</Tag> : null}>
          <div className="relative">
            <input id="item-brand" value={values.brand} maxLength={40} onChange={(e) => onChange("brand", e.target.value)} className={cn(fieldClass(ai("brand")), "h-11")} />
            <AiMark show={ai("brand")} label={t.aiFilledLabel} />
          </div>
        </Field>
        <Field label={t.sensitive} htmlFor="item-sensitive">
          <Switch id="item-sensitive" label={t.sensitive} checked={values.isSensitive} onChange={(v) => onChange("isSensitive", v)} />
        </Field>
      </div>

      <Field label={t.publicSummary} htmlFor="item-summary" extra={<Tag tone="muted">{t.visibleToOwner}</Tag>}>
        <div className="relative">
          <textarea
            id="item-summary"
            rows={3}
            maxLength={200}
            value={values.publicSummary}
            aria-invalid={errors.publicSummary || undefined}
            onChange={(e) => onChange("publicSummary", e.target.value)}
            className={cn(fieldClass(ai("publicSummary")), "min-h-[88px] resize-y py-2.5")}
          />
          <AiMark show={ai("publicSummary")} label={t.aiFilledLabel} />
        </div>
        {errors.publicSummary ? <ErrorText text={t.errors.summary_required} /> : null}
      </Field>

      <Field
        label={t.privateFeatures}
        htmlFor="item-private"
        extra={
          <span className="flex items-center gap-1 text-caption font-medium text-ink-muted">
            <Icon name="lock" size={14} />
            {t.privateNote}
          </span>
        }
      >
        <div className="relative">
          <textarea
            id="item-private"
            rows={3}
            maxLength={500}
            value={values.privateFeatures}
            onChange={(e) => onChange("privateFeatures", e.target.value)}
            className={cn(fieldClass(ai("privateFeatures")), "min-h-[88px] resize-y py-2.5")}
          />
          <AiMark show={ai("privateFeatures")} label={t.aiFilledLabel} />
        </div>
        <p className="text-caption font-medium text-ink-muted">{t.privateHint}</p>
      </Field>

      <WhenWhere values={values} areas={areas} onChange={onChange} />
    </div>
  );
}

/** 습득 일시 · 습득 구역 · 보관 위치 row, shared with the sensitive-item form. */
export function WhenWhere({ values, areas, onChange }: Pick<Props, "values" | "areas" | "onChange">) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      <Field label={t.foundAt} htmlFor="item-found-at">
        <input id="item-found-at" type="datetime-local" value={values.foundAt} onChange={(e) => onChange("foundAt", e.target.value)} className={cn(fieldClass(false), "h-11")} />
      </Field>
      <Field label={t.foundArea} htmlFor="item-area">
        <SelectBox id="item-area" aiFilled={false} value={values.foundArea} onChange={(v) => onChange("foundArea", v)}>
          <option value="">{t.areaUnknown}</option>
          {areas.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </SelectBox>
      </Field>
      <Field label={t.storageLocation} htmlFor="item-storage">
        <input id="item-storage" value={values.storageLocation} maxLength={60} placeholder={t.storagePlaceholder} onChange={(e) => onChange("storageLocation", e.target.value)} className={cn(fieldClass(false), "h-11")} />
      </Field>
    </div>
  );
}

export function SelectBox({
  id,
  value,
  onChange,
  aiFilled,
  invalid,
  children,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  aiFilled: boolean;
  invalid?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="relative">
      <select id={id} value={value} aria-invalid={invalid || undefined} onChange={(e) => onChange(e.target.value)} className={cn(fieldClass(aiFilled), "h-11 appearance-none pr-14")}>
        {children}
      </select>
      {aiFilled ? (
        <span className="pointer-events-none absolute top-3.5 right-9">
          <Icon name="sparkle" size={16} />
        </span>
      ) : null}
      <span className="pointer-events-none absolute top-[13px] right-3">
        <Icon name="chevron-down" size={18} />
      </span>
    </div>
  );
}

function ErrorText({ text }: { text: string }) {
  return (
    <p role="alert" className="flex items-center gap-1.5 text-label font-bold text-danger">
      <Icon name="alert-circle" size={16} />
      {text}
    </p>
  );
}
