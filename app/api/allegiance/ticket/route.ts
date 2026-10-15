// POST: a short-lived signed ticket to join allegiance-realtime as your nation's leader.
import { preflight, route } from "@/lib/allegiance/http";
import { requireNation, requirePlayer } from "@/lib/allegiance/auth";
import { TICKET_SECONDS, realtimeUrl, signTicket } from "@/lib/allegiance/realtime";
import type { TicketResponse } from "@/lib/allegiance/protocol";

export const OPTIONS = preflight;

export const POST = route(async (req): Promise<TicketResponse> => {
  const { player } = await requirePlayer(req);
  const nation = await requireNation(player.id);
  const exp = Math.floor(Date.now() / 1000) + TICKET_SECONDS;
  const ticket = signTicket({ pid: player.id, nid: nation.id, leader: nation.leader, nation: nation.name, color: nation.color, exp });
  return { ticket, url: realtimeUrl(), expiresAt: new Date(exp * 1000).toISOString() };
});
