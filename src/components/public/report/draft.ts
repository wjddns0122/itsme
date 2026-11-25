import { addDays } from "@/lib/dates";
import type { Color } from "@/lib/validation/constants";
import type { LostReportInput, TimeOfDay } from "@/lib/validation/report";

/** What the P-03 form holds while someone fills it in. "Unknown" answers are explicit flags. */
export type ReportDraft = {
  userCategory: string | null;
  colors: Color[];
  colorsUnknown: boolean;
  brandKnown: boolean | null;
  brand: string;
  description: string;
  lostFrom: string;
  lostTo: string;
  timeOfDay: TimeOfDay | "unknown" | null;
  area: string | null;
  areaUnknown: boolean;
  isRental: boolean;
  email: string;
  phone: string;
  name: string;
  secret: string;
  consent: boolean;
};

export function emptyDraft(today: string): ReportDraft {
  return {
    userCategory: null,
    colors: [],
    colorsUnknown: false,
    brandKnown: null,
    brand: "",
    description: "",
    lostFrom: today,
    lostTo: today,
    timeOfDay: null,
    area: null,
    areaUnknown: false,
    isRental: false,
    email: "",
    phone: "",
    name: "",
    secret: "",
    consent: false,
  };
}

const orNull = (v: string) => (v.trim() ? v.trim() : null);

/** Every "잘 모르겠어요" becomes null (or an empty list) so matching leaves it out (docs/02 §3). */
export function draftToInput(d: ReportDraft, reportStartedAt: string | null): LostReportInput {
  return {
    userCategory: d.userCategory,
    colors: d.colorsUnknown ? [] : d.colors,
    brand: d.brandKnown ? orNull(d.brand) : null,
    description: d.description.trim(),
    lostFrom: d.lostFrom,
    lostTo: d.lostTo,
    lostTimeOfDay: d.timeOfDay === "unknown" ? null : d.timeOfDay,
    lostArea: d.areaUnknown ? null : d.area,
    isRental: d.isRental,
    contactName: orNull(d.name),
    contactEmail: orNull(d.email),
    contactPhone: orNull(d.phone),
    secretDetail: orNull(d.secret),
    consent: d.consent,
    reportStartedAt,
  };
}

export type DatePreset = "today" | "yesterday" | "last3Days";

export function datePresetRange(preset: DatePreset, today: string): { lostFrom: string; lostTo: string } {
  if (preset === "today") return { lostFrom: today, lostTo: today };
  if (preset === "yesterday") return { lostFrom: addDays(today, -1), lostTo: addDays(today, -1) };
  return { lostFrom: addDays(today, -2), lostTo: today };
}

export function activeDatePreset(d: Pick<ReportDraft, "lostFrom" | "lostTo">, today: string): DatePreset | null {
  const presets: DatePreset[] = ["today", "yesterday", "last3Days"];
  return presets.find((p) => {
    const r = datePresetRange(p, today);
    return r.lostFrom === d.lostFrom && r.lostTo === d.lostTo;
  }) ?? null;
}
