import Link from "next/link";
import type { Links } from "@/lib/analytics/links";
import type { CityPoint, Row } from "@/lib/analytics/reports";
import { exact } from "@/lib/analytics/format";
import { project } from "@/lib/analytics/geo";
import { COUNTRIES, MAP_H, MAP_W } from "@/lib/analytics/world-map";
import { MapHover } from "./MapHover";

const EMPTY = "rgb(219 234 254 / 0.06)";
/** sqrt so one big country doesn't wash every other one out. */
const shade = (n: number, max: number) => `rgb(79 216 255 / ${(0.14 + 0.82 * Math.sqrt(n / max)).toFixed(3)})`;

// Visitors by country (shaded) and city (gold dots) on a pre-projected Natural Earth map,
// rendered on the server. Every shape and dot links to the same view filtered to it.
export function WorldMap({ countries, cities, links }: { countries: Row[]; cities: CityPoint[]; links: Links }) {
  const byCode = new Map(countries.filter((r) => r.key).map((r) => [r.key!.toUpperCase(), r.visitors]));
  const max = Math.max(1, ...byCode.values());
  const cityMax = Math.max(1, ...cities.map((c) => c.visitors));

  return (
    <MapHover>
      <svg viewBox={`0 0 ${MAP_W} ${MAP_H}`} role="img" aria-label="Visitors by country and city" className="block h-auto w-full">
        <g strokeWidth={0.5} stroke="var(--color-ink)">
          {COUNTRIES.map((c, i) => {
            const n = c.a2 ? (byCode.get(c.a2) ?? 0) : 0;
            const label = `${c.name}: ${exact(n)} visitor${n === 1 ? "" : "s"}`;
            const shape = <path d={c.d} fill={n ? shade(n, max) : EMPTY} data-label={label} className={n ? "hover:stroke-ink-100" : undefined} />;
            return n && c.a2 ? (
              <Link key={i} href={links.filter("country", c.a2)} aria-label={label}>
                {shape}
              </Link>
            ) : (
              <g key={i}>{shape}</g>
            );
          })}
        </g>
        <g>
          {[...cities].reverse().map((c) => {
            const [x, y] = project(c.lat, c.lon);
            const label = `${c.city}${c.country ? `, ${c.country}` : ""}: ${exact(c.visitors)} visitor${c.visitors === 1 ? "" : "s"}`;
            return (
              <Link key={`${c.city}-${c.country}`} href={links.filter("city", c.city)} aria-label={label}>
                <circle
                  cx={x.toFixed(1)}
                  cy={y.toFixed(1)}
                  r={(1.8 + 6 * Math.sqrt(c.visitors / cityMax)).toFixed(2)}
                  fill="rgb(255 200 87 / 0.55)"
                  stroke="var(--color-badge)"
                  strokeWidth={0.6}
                  data-label={label}
                  className="hover:fill-badge"
                />
              </Link>
            );
          })}
        </g>
      </svg>
      <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-[11px] text-ink-500">
        <span className="flex items-center gap-2">
          1
          <span aria-hidden className="h-2 w-24" style={{ background: `linear-gradient(90deg, ${shade(1, 1e9)}, ${shade(1, 1)})` }} />
          {exact(max)} visitors / country
        </span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="h-2 w-2 rounded-full border border-badge bg-badge/55" /> city (size = visitors)
        </span>
      </div>
    </MapHover>
  );
}
