"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

// Date.now() on the client, null during server render and hydration, so
// relative ages ("3 days ago") never cause a hydration mismatch.
export function useNow(): number | null {
  return useSyncExternalStore(subscribe, () => Math.floor(Date.now() / 60_000) * 60_000, () => null);
}
