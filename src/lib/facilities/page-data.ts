import { z } from "zod";
import type { FacilityType, PublicFacility } from "./public";

/** Everything the facility page (P-02) and drop-off guide (P-06) may show. docs/04-architecture.md §9-2. */
export type PublicFacilityPage = PublicFacility & {
  intro: string | null;
  homepageUrl: string | null;
  contactPhone: string | null;
  hours: string | null;
  deskLocation: string | null;
  pickupGuide: string | null;
};

export type FacilityRow = {
  slug: string;
  name: string;
  region: string | null;
  type: FacilityType;
  intro: string | null;
  homepage_url: string | null;
  contact_phone: string | null;
  hours: string | null;
  desk_location: string | null;
  pickup_guide: string | null;
};

export const FacilitySlugSchema = z.string().regex(/^[a-z0-9][a-z0-9-]{0,62}$/);

const blankToNull = (v: string | null) => (v && v.trim() ? v.trim() : null);

export function toFacilityPage(row: FacilityRow): PublicFacilityPage {
  return {
    slug: row.slug,
    name: row.name,
    region: row.region ?? "",
    type: row.type,
    intro: blankToNull(row.intro),
    homepageUrl: blankToNull(row.homepage_url),
    contactPhone: blankToNull(row.contact_phone),
    hours: blankToNull(row.hours),
    deskLocation: blankToNull(row.desk_location),
    pickupGuide: blankToNull(row.pickup_guide),
  };
}

export type InfoRow = { label: "desk" | "contact" | "hours"; value: string };

/**
 * Rows of the desk card. Location and phone share the 안내데스크 row; with no location the phone
 * gets its own 연락처 row (Figma "정보가 적은 시설"). Missing values are left out.
 */
export function deskInfoRows(f: Pick<PublicFacilityPage, "deskLocation" | "contactPhone" | "hours">): InfoRow[] {
  const rows: InfoRow[] = [];
  if (f.deskLocation) {
    rows.push({ label: "desk", value: f.contactPhone ? `${f.deskLocation} · ${f.contactPhone}` : f.deskLocation });
  } else if (f.contactPhone) {
    rows.push({ label: "contact", value: f.contactPhone });
  }
  if (f.hours) rows.push({ label: "hours", value: f.hours });
  return rows;
}
