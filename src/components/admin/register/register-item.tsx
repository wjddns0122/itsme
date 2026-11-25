"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Icon } from "@/components/icon";
import { PhotoCapture, type PhotoItem } from "@/components/photo-capture";
import { CATEGORIES } from "@/lib/validation/constants";
import { analyzePhoto, createFoundItem, createSensitiveItem, uploadItemPhotos, type AiMeta } from "@/server/actions/items";
import ko from "../../../../messages/ko.json";
import { Banner, Field } from "./form-controls";
import { ItemForm, SelectBox, WhenWhere } from "./item-form";
import { applyExtraction, emptyValues, lastStorageKey, validateRegister, type AiField, type RegisterErrors, type RegisterValues } from "./register-state";

const t = ko.admin.register;
const MANUAL_BUTTON_AFTER_MS = 10_000;

type Phase = "photo" | "analyzing" | "form";
type AiState = AiMeta & { features: string[]; material: string | null; confidence: number };
type Props = { facilityId: string; areas: string[]; nowLocal: string };

/**
 * A-03 습득물 등록: photo → AI fills the form → check and save, then the next item.
 * [민감 물품] switches to a form that never sends photos to the AI.
 */
export function RegisterItem({ facilityId, areas, nowLocal }: Props) {
  const router = useRouter();
  const [mode, setMode] = useState<"normal" | "sensitive">("normal");
  const [phase, setPhase] = useState<Phase>("photo");
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [uploaded, setUploaded] = useState<string[]>([]);
  const [values, setValues] = useState<RegisterValues>(() => emptyValues(nowLocal, ""));
  const [aiFilled, setAiFilled] = useState<Set<AiField>>(new Set());
  const [ai, setAi] = useState<AiState | null>(null);
  const [banner, setBanner] = useState<"ai_failed" | "sensitive" | null>(null);
  const [showManual, setShowManual] = useState(false);
  const [errors, setErrors] = useState<RegisterErrors>({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ tone: "info" | "warn"; text: string } | null>(null);
  const edited = useRef(new Set<AiField>());
  const startedAt = useRef<string | null>(null);

  const markStarted = () => {
    startedAt.current ??= new Date().toISOString();
  };

  const rememberedStorage = () => {
    try {
      return window.localStorage.getItem(lastStorageKey(facilityId)) ?? "";
    } catch {
      return "";
    }
  };

  const enterForm = () => {
    setPhase("form");
    setValues((v) => (v.storageLocation ? v : { ...v, storageLocation: rememberedStorage() }));
  };

  const onChange = <K extends keyof RegisterValues>(key: K, value: RegisterValues[K]) => {
    setValues((v) => ({ ...v, [key]: value }));
    if (key !== "foundAt" && key !== "foundArea" && key !== "storageLocation") {
      edited.current.add(key as AiField);
      setAiFilled((s) => {
        const next = new Set(s);
        next.delete(key as AiField);
        return next;
      });
    }
    setErrors({});
  };

  const analyze = async (items: PhotoItem[]) => {
    setPhase("analyzing");
    setShowManual(false);
    const timer = window.setTimeout(() => setShowManual(true), MANUAL_BUTTON_AFTER_MS);
    const fd = new FormData();
    items.forEach((p) => fd.append("photos", p.file));
    if (values.foundArea) fd.append("foundArea", values.foundArea);

    const result = await analyzePhoto(fd);
    window.clearTimeout(timer);
    if (!result.ok) {
      setMessage({ tone: "warn", text: t.errors.upload_failed });
      setPhotos([]);
      setPhase("photo");
      return;
    }
    setUploaded(result.data.photoPaths);
    const { extraction } = result.data;
    if (extraction && result.data.ai) {
      // aiFilled depends only on the AI answer and what the admin already edited, not on the values.
      setValues((v) => applyExtraction(v, edited.current, extraction).values);
      setAiFilled(applyExtraction(values, edited.current, extraction).aiFilled);
      setAi({ ...result.data.ai, features: extraction.features, material: extraction.material, confidence: extraction.confidence });
      setBanner(extraction.is_sensitive ? "sensitive" : null);
    } else {
      setAi(null);
      setBanner("ai_failed");
    }
    enterForm();
  };

  const onAdd = (added: PhotoItem[]) => {
    markStarted();
    setMessage(null);
    const all = [...photos, ...added];
    setPhotos(all);
    // The first photos start the analysis; later ones are only stored (no second AI call).
    if (mode === "normal" && phase === "photo" && uploaded.length === 0) void analyze(all);
  };

  const onRemove = (index: number) => {
    URL.revokeObjectURL(photos[index].url);
    setPhotos((p) => p.filter((_, i) => i !== index));
    if (index < uploaded.length) setUploaded((u) => u.filter((_, i) => i !== index));
  };

  const reset = () => {
    photos.forEach((p) => URL.revokeObjectURL(p.url));
    setPhotos([]);
    setUploaded([]);
    setValues((v) => ({ ...emptyValues(nowLocal, v.storageLocation), foundArea: v.foundArea }));
    setAiFilled(new Set());
    setAi(null);
    setBanner(null);
    setErrors({});
    edited.current = new Set();
    startedAt.current = null;
    setPhase("photo");
  };

  const afterSave = (id: string, again: boolean) => {
    try {
      window.localStorage.setItem(lastStorageKey(facilityId), values.storageLocation);
    } catch {
      // Storage blocked: the next item just starts with an empty storage spot.
    }
    if (again) {
      reset();
      setMessage({ tone: "info", text: t.saved });
      window.scrollTo({ top: 0 });
    } else {
      router.push(`/admin/items/${id}`);
    }
  };

  const save = async (again: boolean) => {
    const found = validateRegister(values);
    if (Object.keys(found).length > 0) {
      setErrors(found);
      return;
    }
    setSaving(true);
    setMessage(null);
    const extra = photos.slice(uploaded.length);
    let photoPaths = uploaded;
    if (extra.length > 0) {
      const fd = new FormData();
      extra.forEach((p) => fd.append("photos", p.file));
      const up = await uploadItemPhotos(fd);
      if (!up.ok) {
        setSaving(false);
        setMessage({ tone: "warn", text: t.errors.upload_failed });
        return;
      }
      photoPaths = [...uploaded, ...up.data.photoPaths];
    }
    const result = await createFoundItem({
      ...values,
      category: values.category || "other.other",
      photoPaths,
      extraction: ai,
      registerStartedAt: startedAt.current,
    });
    setSaving(false);
    if (!result.ok) {
      setMessage({ tone: "warn", text: t.errors.internal });
      return;
    }
    afterSave(result.data.id, again);
  };

  const saveSensitive = async (again: boolean) => {
    setSaving(true);
    setMessage(null);
    const fd = new FormData();
    photos.forEach((p) => fd.append("photos", p.file));
    fd.append(
      "payload",
      JSON.stringify({
        category: values.category || "wallet_card.card",
        foundAt: values.foundAt,
        foundArea: values.foundArea,
        storageLocation: values.storageLocation,
        registerStartedAt: startedAt.current,
      }),
    );
    const result = await createSensitiveItem(fd);
    setSaving(false);
    if (!result.ok) {
      setMessage({ tone: "warn", text: t.errors.internal });
      return;
    }
    afterSave(result.data.id, again);
  };

  const switchMode = () => {
    reset();
    setMessage(null);
    if (mode === "normal") {
      setMode("sensitive");
      setValues((v) => ({ ...v, category: "wallet_card.card", storageLocation: v.storageLocation || rememberedStorage() }));
    } else {
      setMode("normal");
    }
  };

  const sensitive = mode === "sensitive";
  const showActions = sensitive || phase === "form";

  return (
    <main className="flex flex-col gap-5 px-4 pt-6 pb-8 md:px-6">
      <div className="flex items-center gap-3">
        <h1 className="text-page font-bold tracking-[-0.01em] text-ink">{sensitive ? t.sensitiveMode.title : t.title}</h1>
        <span className="flex-1" />
        <button
          type="button"
          onClick={switchMode}
          aria-pressed={sensitive}
          className="flex h-9 items-center gap-1.5 rounded-ui-sm border border-line-strong bg-surface pr-3 pl-2.5 text-label font-bold text-ink"
        >
          <Icon name="shield-alert" size={16} />
          {sensitive ? t.sensitiveMode.back : t.sensitiveButton}
        </button>
      </div>

      {message ? <Banner tone={message.tone}>{message.text}</Banner> : null}
      {sensitive ? <Banner tone="info">{t.sensitiveMode.notice}</Banner> : null}
      {!sensitive && banner === "ai_failed" ? <Banner tone="warn">{t.aiFailed}</Banner> : null}
      {!sensitive && banner === "sensitive" ? <Banner tone="warn">{t.sensitiveDetected}</Banner> : null}

      <div className="flex flex-col gap-5 md:flex-row md:items-start">
        <div className="md:w-[240px] md:shrink-0">
          <PhotoCapture photos={photos} onAdd={onAdd} onRemove={onRemove} disabled={saving || phase === "analyzing"} />
        </div>

        <div className="min-w-0 flex-1">
          {sensitive ? (
            <div className="flex flex-col gap-4 rounded-ui-md border border-line bg-surface p-5">
              <Field label={t.category} htmlFor="sensitive-category">
                <SelectBox id="sensitive-category" aiFilled={false} value={values.category} onChange={(v) => setValues((s) => ({ ...s, category: v as RegisterValues["category"] }))}>
                  {CATEGORIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.label}
                    </option>
                  ))}
                </SelectBox>
              </Field>
              <WhenWhere values={values} areas={areas} onChange={onChange} />
            </div>
          ) : phase === "photo" ? (
            <div className="flex flex-col items-start gap-3 rounded-ui-md border border-line bg-surface p-5">
              <p className="text-desc text-ink-muted">{t.photoFirst}</p>
              <button type="button" onClick={() => { markStarted(); enterForm(); }} className="flex h-11 items-center rounded-ui-sm border border-line-strong bg-surface px-4 text-button font-bold text-ink">
                {t.manualEntry}
              </button>
            </div>
          ) : phase === "analyzing" ? (
            <div role="status" className="flex flex-col gap-4 rounded-ui-md border border-line bg-surface p-5">
              <p className="flex items-center gap-2 text-body leading-[1.5] font-bold text-ink">
                <Icon name="spinner" size={18} className="animate-spin" />
                {t.analyzing}
              </p>
              {[0, 1, 2, 3].map((i) => (
                <span key={i} aria-hidden className="h-11 animate-pulse rounded-ui-sm bg-ai-fill" />
              ))}
              {showManual ? (
                <button type="button" onClick={enterForm} className="flex h-11 items-center self-start rounded-ui-sm border border-line-strong bg-surface px-4 text-button font-bold text-ink">
                  {t.manualEntry}
                </button>
              ) : null}
            </div>
          ) : (
            <ItemForm values={values} aiFilled={aiFilled} errors={errors} areas={areas} onChange={onChange} />
          )}
        </div>
      </div>

      {showActions ? (
        <div className="flex justify-end gap-2">
          <button
            type="button"
            disabled={saving}
            onClick={() => void (sensitive ? saveSensitive(false) : save(false))}
            className="flex h-11 items-center rounded-ui-sm border border-line-strong bg-surface px-4 text-button font-bold text-ink disabled:opacity-60"
          >
            {t.save}
          </button>
          <button
            type="button"
            disabled={saving}
            aria-busy={saving}
            onClick={() => void (sensitive ? saveSensitive(true) : save(true))}
            className="flex h-11 items-center gap-2 rounded-ui-sm bg-brand px-4 text-button font-bold text-on-brand disabled:opacity-85"
          >
            {saving ? <Icon name="spinner" size={18} className="animate-spin" /> : null}
            {t.saveAndContinue}
          </button>
        </div>
      ) : null}
    </main>
  );
}
