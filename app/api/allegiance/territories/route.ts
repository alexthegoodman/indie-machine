// GET ?since=<ISO>: territory rows changed since then (all of them from the start), oldest first.
import { db } from "@/lib/allegiance/db";
import { ApiError, preflight, route } from "@/lib/allegiance/http";
import { requirePlayer } from "@/lib/allegiance/auth";
import { ROW_INCLUDE, toRow } from "@/lib/allegiance/territory";
import type { TerritoriesResponse } from "@/lib/allegiance/protocol";

const PAGE = 2000;

export const OPTIONS = preflight;

export const GET = route(async (req): Promise<TerritoriesResponse> => {
  await requirePlayer(req);
  const sinceText = new URL(req.url).searchParams.get("since");
  const since = sinceText ? new Date(sinceText) : new Date(0);
  if (Number.isNaN(since.getTime())) throw new ApiError(400, "invalid", "since must be an ISO date.");
  const now = new Date();
  const rows = await db().allegianceTerritory.findMany({ where: { updatedAt: { gte: since } }, include: ROW_INCLUDE, orderBy: { updatedAt: "asc" }, take: PAGE + 1 });
  return { rows: rows.slice(0, PAGE).map(toRow), now: now.toISOString(), more: rows.length > PAGE };
});
