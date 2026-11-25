import { z } from "zod";

// A-08 시설 설정 (docs/03-screens.md A-08). The slug is not editable: printed links and QR codes use it.

export const FACILITY_TYPES = ["school", "ski_resort", "hotel", "festival", "cafe", "other"] as const;
export const FACILITY_LIMITS = { name: 60, short: 60, intro: 120, guide: 300, area: 30, areas: 30, transferMin: 1, transferMax: 3650 } as const;

const optional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .transform((v) => (v ? v : null));

export const FacilitySettingsSchema = z.object({
  name: z.string().trim().min(1).max(FACILITY_LIMITS.name),
  type: z.enum(FACILITY_TYPES),
  region: optional(FACILITY_LIMITS.short),
  address: optional(FACILITY_LIMITS.short * 2),
  contactPhone: optional(FACILITY_LIMITS.short),
  homepageUrl: z
    .string()
    .trim()
    .max(200)
    .nullable()
    .transform((v) => (v ? v : null))
    .refine((v) => v === null || /^https?:\/\//.test(v), { message: "url" }),
  intro: optional(FACILITY_LIMITS.intro),
  hours: optional(FACILITY_LIMITS.short),
  deskLocation: optional(FACILITY_LIMITS.short),
  pickupGuide: optional(FACILITY_LIMITS.guide),
  transferDays: z.number().int().min(FACILITY_LIMITS.transferMin).max(FACILITY_LIMITS.transferMax),
  areas: z
    .array(z.string().trim().min(1).max(FACILITY_LIMITS.area))
    .max(FACILITY_LIMITS.areas)
    .transform((list) => [...new Set(list)]),
  isListed: z.boolean(),
});
export type FacilitySettingsInput = z.input<typeof FacilitySettingsSchema>;
