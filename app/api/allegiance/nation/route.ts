// GET: your active nation and its save. POST: found a new nation (New Nation / New Party); the
// old one is dissolved and its territory returns to the regimes.
import { db } from "@/lib/allegiance/db";
import { ApiError, body, num, preflight, route, str } from "@/lib/allegiance/http";
import { activeNation, requireNation, requirePlayer } from "@/lib/allegiance/auth";
import { endNation, toEvent } from "@/lib/allegiance/territory";
import { push } from "@/lib/allegiance/realtime";
import { nationInfo } from "@/lib/allegiance/views";
import type { FoundRequest, NationResponse } from "@/lib/allegiance/protocol";

export const OPTIONS = preflight;

export const GET = route(async (req): Promise<NationResponse> => {
  const { player } = await requirePlayer(req);
  const n = await requireNation(player.id);
  return { nation: nationInfo(n), save: n.save ?? null, saveVersion: n.saveVersion };
});

export const POST = route(async req => {
  const { player } = await requirePlayer(req);
  const b = await body<Partial<FoundRequest>>(req);
  const color = str(b.color, "Color", 7, 7);
  if (!/^#[0-9a-f]{6}$/i.test(color)) throw new ApiError(400, "invalid", "Color must be #rrggbb.");
  const home = (b.home ?? {}) as Partial<FoundRequest["home"]>;
  const data = {
    name: str(b.name, "Party name", 40), leader: str(b.leader, "Leader name", 40), ideology: str(b.ideology, "Ideology", 40), color: color.toLowerCase(),
    homeName: str(home.name, "Home town", 80), homeLat: num(home.lat, "Latitude", -90, 90), homeLon: num(home.lon, "Longitude", -180, 180),
  };
  const old = await activeNation(player.id);
  const released = old ? await endNation(old.id) : [];
  const nation = await db().allegianceNation.create({ data: { playerId: player.id, ...data } });
  const e = await db().allegianceEvent.create({ data: { kind: "founded", text: `${nation.name} is founded in ${nation.homeName}.`, nationId: nation.id } });
  const errors = [released.length ? await push({ type: "territory", rows: released }) : null, await push({ type: "event", event: toEvent(e) })].filter(Boolean);
  return { nation: nationInfo(nation), ...(errors.length ? { pushError: errors.join(" ") } : {}) };
});
