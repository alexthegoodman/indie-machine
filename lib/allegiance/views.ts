// Shapes the API returns for players and nations.
import type { AllegianceNation, AllegiancePlayer } from "../../generated/prisma/client";
import type { NationInfo, PlayerInfo } from "./protocol";
import { nationSummary } from "./territory";

export const playerInfo = (p: AllegiancePlayer): PlayerInfo => ({ id: p.id, email: p.email, anonymous: !p.email });

export const nationInfo = (n: AllegianceNation): NationInfo => ({
  ...nationSummary(n), homeName: n.homeName, homeLat: n.homeLat, homeLon: n.homeLon,
  foundedAt: n.foundedAt.toISOString(), savedAt: n.savedAt?.toISOString() ?? null,
});
