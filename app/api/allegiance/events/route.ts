// GET ?after=<id>: world news, the latest 50 (newest last).
import { db } from "@/lib/allegiance/db";
import { preflight, route } from "@/lib/allegiance/http";
import { requirePlayer } from "@/lib/allegiance/auth";
import { toEvent } from "@/lib/allegiance/territory";
import type { EventsResponse } from "@/lib/allegiance/protocol";

export const OPTIONS = preflight;

export const GET = route(async (req): Promise<EventsResponse> => {
  await requirePlayer(req);
  const after = Number(new URL(req.url).searchParams.get("after") ?? 0) || 0;
  const events = await db().allegianceEvent.findMany({ where: { id: { gt: after } }, orderBy: { id: "desc" }, take: 50 });
  return { events: events.reverse().map(toEvent) };
});
