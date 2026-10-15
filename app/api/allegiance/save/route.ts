// PUT { save, saveVersion }: stores the active nation's campaign.
import { db } from "@/lib/allegiance/db";
import { ApiError, body, num, preflight, route } from "@/lib/allegiance/http";
import { requireNation, requirePlayer } from "@/lib/allegiance/auth";
import type { SaveRequest } from "@/lib/allegiance/protocol";

export const OPTIONS = preflight;

export const PUT = route(async req => {
  const { player } = await requirePlayer(req);
  const nation = await requireNation(player.id);
  const b = await body<Partial<SaveRequest>>(req);
  if (!b.save || typeof b.save !== "object") throw new ApiError(400, "invalid", "save must be an object.");
  const saveVersion = Math.round(num(b.saveVersion, "saveVersion", 1, 1000));
  const savedAt = new Date();
  await db().allegianceNation.update({ where: { id: nation.id }, data: { save: b.save as object, saveVersion, savedAt } });
  return { savedAt: savedAt.toISOString() };
});
