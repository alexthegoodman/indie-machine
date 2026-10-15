// POST ReleaseRequest: a regime took one of your territories back in your sim.
import { body, oneOf, preflight, regionId, route, str } from "@/lib/allegiance/http";
import { requireNation, requirePlayer } from "@/lib/allegiance/auth";
import { release } from "@/lib/allegiance/territory";
import { push } from "@/lib/allegiance/realtime";
import { AI_FACTIONS, type ReleaseRequest } from "@/lib/allegiance/protocol";

export const OPTIONS = preflight;

export const POST = route(async req => {
  const { player } = await requirePlayer(req);
  const nation = await requireNation(player.id);
  const b = await body<Partial<ReleaseRequest>>(req);
  const { row, event } = await release(nation, regionId(b.regionId), oneOf(b.to, "to", AI_FACTIONS), str(b.why, "why", 120));
  const errors = [row ? await push({ type: "territory", rows: [row] }) : null, event ? await push({ type: "event", event }) : null].filter(Boolean);
  return { row, ...(errors.length ? { pushError: errors.join(" ") } : {}) };
});
