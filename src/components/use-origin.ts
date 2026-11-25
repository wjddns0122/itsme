"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/** This site's origin in the browser, "" while rendering on the server (no hydration mismatch). */
export function useOrigin(): string {
  return useSyncExternalStore(subscribe, () => window.location.origin, () => "");
}
