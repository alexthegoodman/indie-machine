"use client";

import { useEffect, useState } from "react";
import { OPT_OUT_KEY } from "@/lib/analytics/events";
import { setOptOut } from "@/lib/analytics/client";

// Whoever reads the dashboard is excluded from the numbers by default; this toggles it.
export function ThisBrowser() {
  const [off, setOff] = useState<boolean | null>(null);

  useEffect(() => {
    let v: string | null = null;
    try {
      v = localStorage.getItem(OPT_OUT_KEY);
      if (v === null) {
        localStorage.setItem(OPT_OUT_KEY, "1");
        v = "1";
      }
    } catch {
      // storage blocked: nothing is tracked from here anyway
    }
    setOff(v === "1");
  }, []);

  if (off === null) return null;
  return (
    <button
      type="button"
      onClick={() => {
        setOptOut(!off);
        setOff(!off);
      }}
      className="cursor-pointer text-ink-400 hover:text-accent"
      title="Visits from this browser are left out of the data while excluded."
    >
      THIS BROWSER: {off ? "EXCLUDED" : "TRACKED"}
    </button>
  );
}
