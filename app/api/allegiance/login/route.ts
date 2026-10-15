// POST { email, password }: opens a session for an account on this device.
import { db } from "@/lib/allegiance/db";
import { ApiError, body, preflight, route } from "@/lib/allegiance/http";
import { activeNation, normalizeEmail, openSession, verifyPassword } from "@/lib/allegiance/auth";
import { nationInfo, playerInfo } from "@/lib/allegiance/views";
import type { SessionResponse } from "@/lib/allegiance/protocol";

const MAX_FAILS = 8;
const LOCK_MS = 15 * 60_000;

export const OPTIONS = preflight;

export const POST = route(async (req): Promise<SessionResponse> => {
  const b = await body<{ email?: unknown; password?: unknown }>(req);
  const email = normalizeEmail(b.email);
  const password = typeof b.password === "string" ? b.password : "";
  const player = await db().allegiancePlayer.findUnique({ where: { email } });
  const wrong = new ApiError(401, "bad-login", "Wrong email or password.");
  if (!player?.passwordHash) throw wrong;
  if (player.lockedUntil && player.lockedUntil > new Date()) throw new ApiError(429, "locked", "Too many wrong passwords. Try again in 15 minutes.");
  if (!(await verifyPassword(password, player.passwordHash))) {
    const fails = player.failedLogins + 1;
    await db().allegiancePlayer.update({
      where: { id: player.id },
      data: fails >= MAX_FAILS ? { failedLogins: 0, lockedUntil: new Date(Date.now() + LOCK_MS) } : { failedLogins: fails },
    });
    throw wrong;
  }
  await db().allegiancePlayer.update({ where: { id: player.id }, data: { failedLogins: 0, lockedUntil: null, lastSeenAt: new Date() } });
  const nation = await activeNation(player.id);
  return { token: await openSession(player.id), player: playerInfo(player), nation: nation ? nationInfo(nation) : null };
});
