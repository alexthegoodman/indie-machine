// POST: without a bearer token, starts an anonymous player and returns their token; with one,
// resumes that session (401 when it is no longer valid).
import { db } from "@/lib/allegiance/db";
import { preflight, route } from "@/lib/allegiance/http";
import { activeNation, openSession, requirePlayer } from "@/lib/allegiance/auth";
import { nationInfo, playerInfo } from "@/lib/allegiance/views";
import type { SessionResponse } from "@/lib/allegiance/protocol";

export const OPTIONS = preflight;

export const POST = route(async (req): Promise<SessionResponse> => {
  const auth = req.headers.get("authorization");
  if (auth) {
    const { player } = await requirePlayer(req);
    const nation = await activeNation(player.id);
    return { token: auth.slice(7).trim(), player: playerInfo(player), nation: nation ? nationInfo(nation) : null };
  }
  const player = await db().allegiancePlayer.create({ data: {} });
  return { token: await openSession(player.id), player: playerInfo(player), nation: null };
});
