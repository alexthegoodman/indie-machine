// Sessions and accounts. A player starts anonymous (a random bearer token, stored hashed) and can
// later claim an email and password; signing in on another device opens another session.

import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { ApiError } from "./http";
import { db } from "./db";

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number, opts: { N: number; r: number; p: number; maxmem: number }) => Promise<Buffer>;

export const newToken = (): string => randomBytes(32).toString("base64url");
export const hashToken = (token: string): string => createHash("sha256").update(token).digest("hex");

const N = 1 << 15, R = 8, P = 1, KEYLEN = 32;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, KEYLEN, { N, r: R, p: P, maxmem: 64 * 1024 * 1024 });
  return `scrypt$${N}$${R}$${P}$${salt.toString("base64url")}$${key.toString("base64url")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [kind, n, r, p, salt, key] = stored.split("$");
  if (kind !== "scrypt") return false;
  const want = Buffer.from(key, "base64url");
  const got = await scrypt(password, Buffer.from(salt, "base64url"), want.length, { N: Number(n), r: Number(r), p: Number(p), maxmem: 64 * 1024 * 1024 });
  return timingSafeEqual(want, got);
}

export function normalizeEmail(v: unknown): string {
  if (typeof v !== "string") throw new ApiError(400, "invalid", "Email must be a string.");
  const email = v.trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ApiError(400, "invalid", "That email address doesn't look right.");
  return email;
}

export function checkPassword(v: unknown): string {
  if (typeof v !== "string" || v.length < 8 || v.length > 200) throw new ApiError(400, "invalid", "Passwords need 8 to 200 characters.");
  return v;
}

/** Opens a session for a player and returns its bearer token. */
export async function openSession(playerId: string): Promise<string> {
  const token = newToken();
  await db().allegianceSession.create({ data: { playerId, tokenHash: hashToken(token) } });
  return token;
}

/** The player behind the request's bearer token (401 without a valid one). */
export async function requirePlayer(req: Request) {
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) throw new ApiError(401, "unauthorized", "Not signed in.");
  const session = await db().allegianceSession.findUnique({ where: { tokenHash: hashToken(token) }, include: { player: true } });
  if (!session) throw new ApiError(401, "unauthorized", "This session has expired. Sign in again.");
  const now = new Date();
  // Touch at most once a minute: every request would otherwise be a write.
  if (now.getTime() - session.lastUsedAt.getTime() > 60_000) {
    await db().$transaction([
      db().allegianceSession.update({ where: { id: session.id }, data: { lastUsedAt: now } }),
      db().allegiancePlayer.update({ where: { id: session.playerId }, data: { lastSeenAt: now } }),
    ]);
  }
  return { session, player: session.player };
}

export async function activeNation(playerId: string) {
  return db().allegianceNation.findFirst({ where: { playerId, active: true } });
}

export async function requireNation(playerId: string) {
  const n = await activeNation(playerId);
  if (!n) throw new ApiError(409, "no-nation", "Found a nation first.");
  return n;
}
