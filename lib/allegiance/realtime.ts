// The link to allegiance-realtime (Cloudflare Durable Objects): signed join tickets for the game's
// sockets, and pushes of territory changes and world news to everyone connected.

import { createHmac } from "node:crypto";
import { ApiError } from "./http";
import type { TerritoryRow, WorldEvent } from "./protocol";

export const TICKET_SECONDS = 120;

function secret(): string {
  const s = process.env.ALLEGIANCE_REALTIME_SECRET;
  if (!s) throw new ApiError(500, "config", "ALLEGIANCE_REALTIME_SECRET is not set on the server.");
  return s;
}

export function realtimeUrl(): string {
  const u = process.env.ALLEGIANCE_REALTIME_URL;
  if (!u) throw new ApiError(500, "config", "ALLEGIANCE_REALTIME_URL is not set on the server.");
  return u.replace(/\/+$/, "");
}

export interface TicketClaims {
  /** Player and nation ids. */
  pid: string;
  nid: string;
  leader: string;
  nation: string;
  color: string;
  /** Unix seconds. */
  exp: number;
}

/** `<payload>.<signature>`, both base64url; HMAC-SHA256 over the payload text. */
export function signTicket(claims: TicketClaims): string {
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
  const sig = createHmac("sha256", secret()).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export type Push = { type: "territory"; rows: TerritoryRow[] } | { type: "event"; event: WorldEvent };

/**
 * Sends a push to every connected client through the realtime world hub. Returns an error message
 * when the hub could not be reached, so the API response can tell the player.
 */
export async function push(message: Push): Promise<string | null> {
  const url = realtimeUrl().replace(/^ws/, "http") + "/internal/push";
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${secret()}` },
      body: JSON.stringify(message),
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return `Realtime server answered ${res.status}: ${(await res.text()).slice(0, 200)}`;
    return null;
  } catch (e) {
    return `Realtime server unreachable: ${(e as Error).message}`;
  }
}

/** Requests from allegiance-realtime itself (it reports street outcomes) carry the shared secret. */
export function requireRealtime(req: Request): void {
  const header = req.headers.get("authorization") ?? "";
  if (header !== `Bearer ${secret()}`) throw new ApiError(401, "unauthorized", "Not the realtime server.");
}
