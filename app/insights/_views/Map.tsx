import { BarList, Card } from "@/components/insights/ui";
import { WorldMap } from "@/components/insights/WorldMap";
import { breakdown, cities as citiesReport } from "@/lib/analytics/reports";
import type { ViewProps } from "./types";

// Where visitors are: countries and cities from Vercel's edge headers.
export async function MapView({ q, links }: ViewProps) {
  const [countries, cities, cityRows] = await Promise.all([breakdown(q, "country", { limit: 250 }), citiesReport(q), breakdown(q, "city", { limit: 25 })]);
  const total = countries.reduce((s, r) => s + r.visitors, 0);
  const local = countries.every((r) => r.key === null);

  return (
    <div className="space-y-4">
      <Card
        title="Visitors by location"
        note={
          local
            ? "Locations come from Vercel's edge headers, so local runs have none."
            : "Shading is visitors per country; dots are cities, placed at the city centre Vercel reports (stored since the map was added, so older events have no dot)."
        }
      >
        <WorldMap countries={countries} cities={cities} links={links} />
      </Card>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Countries">
          <BarList rows={countries} dim="country" links={links} total={total || undefined} limit={25} />
        </Card>
        <Card title="Cities">
          <BarList rows={cityRows} dim="city" links={links} total={total || undefined} />
        </Card>
      </div>
    </div>
  );
}
