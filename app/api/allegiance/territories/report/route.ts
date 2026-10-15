// POST ReportRequest: troops and support in every territory you hold; returns where the server's
// record differs (territory lost to another nation, or held but missing from the report).
import { body, preflight, route } from "@/lib/allegiance/http";
import { requireNation, requirePlayer } from "@/lib/allegiance/auth";
import { parseHoldings, report } from "@/lib/allegiance/territory";
import type { ReportResponse } from "@/lib/allegiance/protocol";

export const OPTIONS = preflight;

export const POST = route(async (req): Promise<ReportResponse> => {
  const { player } = await requirePlayer(req);
  const nation = await requireNation(player.id);
  const b = await body<{ holdings?: unknown }>(req);
  return report(nation, parseHoldings(b.holdings));
});
