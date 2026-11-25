"use client";

import { useEffect } from "react";
import type { PublicFacility } from "@/lib/facilities/public";
import { rememberFacility } from "@/lib/recent-facilities";

/** Adds the facility to "최근 본 시설" on P-01 (this browser only). Renders nothing. */
export function RememberFacility({ facility }: { facility: PublicFacility }) {
  const { slug, name, region, type } = facility;
  useEffect(() => {
    rememberFacility({ slug, name, region, type });
  }, [slug, name, region, type]);
  return null;
}
