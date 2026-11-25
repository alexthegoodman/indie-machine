// Points onto the /insights world map (lib/analytics/world-map.ts). Equal Earth forward
// projection, same constants as d3-geo's geoEqualEarthRaw, with the map's scale and translate.
import { MAP_K, MAP_T } from "./world-map.ts";

const A1 = 1.340264;
const A2 = -0.081106;
const A3 = 0.000893;
const A4 = 0.003796;
const M = Math.sqrt(3) / 2;

/** [x, y] in map units for a latitude/longitude in degrees. */
export function project(lat: number, lon: number): [number, number] {
  const lambda = (lon * Math.PI) / 180;
  const l = Math.asin(M * Math.sin((lat * Math.PI) / 180));
  const l2 = l * l;
  const l6 = l2 * l2 * l2;
  const x = (lambda * Math.cos(l)) / (M * (A1 + 3 * A2 * l2 + l6 * (7 * A3 + 9 * A4 * l2)));
  const y = l * (A1 + A2 * l2 + l6 * (A3 + A4 * l2));
  return [MAP_T[0] + x * MAP_K, MAP_T[1] - y * MAP_K];
}
