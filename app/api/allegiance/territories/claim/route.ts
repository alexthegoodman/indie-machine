// POST ClaimRequest: your nation took a region. Free territory is recorded; territory another
// nation holds is contested and decided here.
import { body, preflight, route } from "@/lib/allegiance/http";
import { requireNation, requirePlayer } from "@/lib/allegiance/auth";
import { claim, parseClaim } from "@/lib/allegiance/territory";
import { push } from "@/lib/allegiance/realtime";
import type { ClaimResponse } from "@/lib/allegiance/protocol";

export const OPTIONS = preflight;

export const POST = route(async (req): Promise<ClaimResponse> => {
  const { player } = await requirePlayer(req);
  const nation = await requireNation(player.id);
  const { response, event } = await claim(nation, parseClaim(await body(req)));
  const errors = event ? [await push({ type: "territory", rows: [response.row] }), await push({ type: "event", event })].filter(Boolean) : [];
  return errors.length ? { ...response, pushError: errors.join(" ") } : response;
});
