import { z } from "zod";
import { addDays, isIsoDate } from "@/lib/dates";
import { normalizePhone } from "./contact";
import { COLORS } from "./constants";

// P-03 분실 신고 input (docs/03-screens.md P-03). Shared by the form and createLostReport.

/** Category chips on step 1. Values are category codes or top-level groups; normalization refines them (FL-022). */
export const REPORT_CATEGORY_CHIPS = [
  { value: "electronics.phone", label: "휴대폰" },
  { value: "electronics.earphones", label: "이어폰" },
  { value: "wallet_card", label: "지갑·카드" },
  { value: "bag", label: "가방" },
  { value: "clothing", label: "옷·장갑" },
  { value: "sports", label: "고글·헬멧" },
  { value: "accessory.glasses", label: "안경" },
  { value: "key", label: "열쇠" },
  { value: "other", label: "기타" },
] as const;

export const REPORT_CATEGORY_VALUES = REPORT_CATEGORY_CHIPS.map((c) => c.value) as [string, ...string[]];

/** Colors offered on step 1 (Figma shows the common ones; the rest come from normalization). */
export const REPORT_COLOR_CHIPS = ["검정", "흰색", "회색", "빨강", "주황", "노랑", "파랑", "초록", "분홍", "갈색"] as const satisfies readonly (typeof COLORS)[number][];

export const TIMES_OF_DAY = ["morning", "lunch", "afternoon", "evening"] as const;
export type TimeOfDay = (typeof TIMES_OF_DAY)[number];

/** How far back a loss may be reported. Older items have usually gone to the police (ADR-018). */
export const MAX_REPORT_AGE_DAYS = 365;

export const REPORT_LIMITS = { description: 500, brand: 40, area: 60, name: 30, secret: 300, colors: 5 } as const;

/** Error codes shown on the form; messages live in messages/ko.json (public.report.errors). */
export type ReportFieldError = "what_required" | "contact_required" | "consent_required" | "email_invalid" | "phone_invalid" | "date_invalid";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .transform((v) => (v ? v : null));

export const LostReportInputSchema = z.object({
  userCategory: z.enum(REPORT_CATEGORY_VALUES).nullable(),
  colors: z.array(z.enum(COLORS)).max(REPORT_LIMITS.colors),
  brand: optionalText(REPORT_LIMITS.brand),
  description: z.string().trim().max(REPORT_LIMITS.description),
  lostFrom: z.string(),
  lostTo: z.string(),
  lostTimeOfDay: z.enum(TIMES_OF_DAY).nullable(),
  lostArea: optionalText(REPORT_LIMITS.area),
  isRental: z.boolean(),
  contactName: optionalText(REPORT_LIMITS.name),
  contactEmail: optionalText(254),
  contactPhone: optionalText(20),
  secretDetail: optionalText(REPORT_LIMITS.secret),
  consent: z.boolean(),
  reportStartedAt: z.iso.datetime().nullable(),
});

export type LostReportInput = z.infer<typeof LostReportInputSchema>;

const EmailSchema = z.email();

/** Business rules the schema cannot express. `today` is the Seoul date (lib/dates). */
export function reportFieldErrors(input: LostReportInput, today: string): ReportFieldError[] {
  const errors: ReportFieldError[] = [];
  if (!input.userCategory && !input.description) errors.push("what_required");

  const datesOk =
    isIsoDate(input.lostFrom) &&
    isIsoDate(input.lostTo) &&
    input.lostFrom <= input.lostTo &&
    input.lostTo <= today &&
    input.lostFrom >= addDays(today, -MAX_REPORT_AGE_DAYS);
  if (!datesOk) errors.push("date_invalid");

  if (!input.contactEmail && !input.contactPhone) errors.push("contact_required");
  if (input.contactEmail && !EmailSchema.safeParse(input.contactEmail).success) errors.push("email_invalid");
  if (input.contactPhone && !normalizePhone(input.contactPhone)) errors.push("phone_invalid");
  if (!input.consent) errors.push("consent_required");
  return errors;
}

/** Which step of the form owns an error, so the form can jump back to it. */
export function stepOfError(error: ReportFieldError): 1 | 2 | 3 {
  if (error === "what_required") return 1;
  if (error === "date_invalid") return 2;
  return 3;
}
