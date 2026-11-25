"use client";

import { useState } from "react";

// Status line for the server-rendered WorldMap: shows the data-label of whatever is under the
// pointer (or focused), so the SVG itself ships no per-shape client code.
export function MapHover({ children }: { children: React.ReactNode }) {
  const [label, setLabel] = useState<string | null>(null);
  const pick = (e: React.SyntheticEvent) => {
    const t = e.target as Element;
    // Pointer lands on the shape; keyboard focus lands on the link around it.
    const el = t.closest("[data-label]") ?? t.querySelector("[data-label]");
    setLabel(el?.getAttribute("data-label") ?? null);
  };
  return (
    <div onPointerOver={pick} onFocus={pick} onPointerLeave={() => setLabel(null)} onBlur={() => setLabel(null)}>
      {children}
      <div className="mt-1 h-4 text-[11px] text-ink-100" role="status">
        {label ?? <span className="text-ink-500">Hover a country or city; click to filter.</span>}
      </div>
    </div>
  );
}
