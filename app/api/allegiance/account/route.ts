// POST { email, password }: an anonymous player claims an account, keeping their nation.
import { db } from "@/lib/allegiance/db";
import { ApiError, body, preflight, route } from "@/lib/allegiance/http";
import { checkPassword, hashPassword, normalizeEmail, requirePlayer } from "@/lib/allegiance/auth";
import { playerInfo } from "@/lib/allegiance/views";

export const OPTIONS = preflight;

export const POST = route(async req => {
  const { player } = await requirePlayer(req);
  const b = await body<{ email?: unknown; password?: unknown }>(req);
  const email = normalizeEmail(b.email);
  const password = checkPassword(b.password);
  if (player.email) throw new ApiError(409, "has-account", "This player already has an account.");
  if (await db().allegiancePlayer.findUnique({ where: { email } })) throw new ApiError(409, "email-taken", "That email already has an account. Sign in instead.");
  const updated = await db().allegiancePlayer.update({ where: { id: player.id }, data: { email, passwordHash: await hashPassword(password) } });
  return { player: playerInfo(updated) };
});
