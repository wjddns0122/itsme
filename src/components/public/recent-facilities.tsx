"use client";

import { useMemo, useSyncExternalStore } from "react";
import { parseRecentFacilities, readRecentFacilitiesRaw, RECENT_FACILITIES_KEY } from "@/lib/recent-facilities";
import ko from "../../../messages/ko.json";
import { FacilityRow } from "./facility-row";

function subscribe(onChange: () => void) {
  const onStorage = (e: StorageEvent) => {
    if (e.key === RECENT_FACILITIES_KEY) onChange();
  };
  window.addEventListener("storage", onStorage);
  return () => window.removeEventListener("storage", onStorage);
}

/** "최근 본 시설" from this browser only. Renders nothing on the server or when empty. */
export function RecentFacilities() {
  const raw = useSyncExternalStore(subscribe, readRecentFacilitiesRaw, () => null);
  const facilities = useMemo(() => parseRecentFacilities(raw), [raw]);
  if (facilities.length === 0) return null;

  return (
    <section className="flex flex-col gap-3.5">
      <h2 className="text-label font-bold text-ink">{ko.public.home.recent}</h2>
      <ul className="flex flex-col gap-3.5">
        {facilities.map((f) => (
          <li key={f.slug}>
            <FacilityRow facility={f} />
          </li>
        ))}
      </ul>
    </section>
  );
}
