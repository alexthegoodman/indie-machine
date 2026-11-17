"use client";

import { useState } from "react";
import { exact } from "@/lib/analytics/format";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// Sessions by weekday and hour: one accent hue, darker cells fade toward the surface.
export function Heatmap({ cells, tz }: { cells: { dow: number; hour: number; n: number }[]; tz: string }) {
  const [hover, setHover] = useState<{ dow: number; hour: number; n: number } | null>(null);
  const grid = new Map(cells.map((c) => [`${c.dow}-${c.hour}`, c.n]));
  const max = Math.max(1, ...cells.map((c) => c.n));

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="border-separate border-spacing-0.5 text-[10px] text-ink-500">
          <caption className="sr-only">Sessions by weekday and hour ({tz})</caption>
          <thead>
            <tr>
              <th />
              {Array.from({ length: 24 }, (_, h) => (
                <th key={h} scope="col" className="w-5 font-normal">
                  {h % 3 === 0 ? h : ""}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {DAYS.map((d, i) => (
              <tr key={d}>
                <th scope="row" className="pr-2 text-right font-normal">
                  {d}
                </th>
                {Array.from({ length: 24 }, (_, h) => {
                  const n = grid.get(`${i + 1}-${h}`) ?? 0;
                  const active = hover?.dow === i + 1 && hover.hour === h;
                  return (
                    <td
                      key={h}
                      tabIndex={0}
                      aria-label={`${d} ${h}:00, ${n} sessions`}
                      onPointerEnter={() => setHover({ dow: i + 1, hour: h, n })}
                      onFocus={() => setHover({ dow: i + 1, hour: h, n })}
                      onPointerLeave={() => setHover(null)}
                      className={`h-5 w-5 ${active ? "outline outline-ink-100" : ""}`}
                      style={{ background: n ? `rgb(79 216 255 / ${0.12 + 0.88 * (n / max)})` : "rgb(219 234 254 / 0.04)" }}
                    />
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-2 h-4 text-[11px] text-ink-400" role="status">
        {hover ? (
          <>
            <strong className="text-ink-100">{exact(hover.n)}</strong> sessions, {DAYS[hover.dow - 1]} {String(hover.hour).padStart(2, "0")}:00-
            {String(hover.hour).padStart(2, "0")}:59
          </>
        ) : (
          <>Peak hour: {exact(max)} sessions. Hover a cell for its count. Times in {tz}.</>
        )}
      </div>
    </div>
  );
}
