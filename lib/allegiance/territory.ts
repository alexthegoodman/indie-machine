// The territory map between nations. The server is the record of who holds what. Each client runs
// its own strategic sim against the regimes and proposes changes: a claim when it takes a region,
// a release when it loses one to a regime, and a periodic report of its troops and support.
// Taking a region another nation holds is a contest the server decides here, from the defender's
// last reported strength (which decays while its ruler stays away).

import { randomInt } from "node:crypto";
import type { AllegianceNation, AllegianceTerritory } from "../../generated/prisma/client";
import { db } from "./db";
import { ApiError, num, oneOf, regionId, str } from "./http";
import { AI_FACTIONS, GOVS, HOWS, type AiFaction, type ClaimRequest, type ClaimResponse, type Gov, type NationSummary, type RegionInfo, type TerritoryRow, type WorldEvent } from "./protocol";

export const MAX_ARMY = 50_000_000;
/** Claims (won or lost) a nation may make per minute. */
export const CLAIMS_PER_MINUTE = 30;
/** An absent ruler's garrison halves every this many days. */
export const DECAY_HALF_DAYS = 7;

type Row = AllegianceTerritory & { nation: (AllegianceNation & { player: { lastSeenAt: Date } }) | null };

export const nationSummary = (n: AllegianceNation): NationSummary => ({ id: n.id, name: n.name, leader: n.leader, ideology: n.ideology, color: n.color });

/** The holder's troops after the decay of an absent ruler. */
export function effectiveArmy(army: number, lastSeen: Date | null, now = Date.now()): number {
  if (!lastSeen) return army;
  const days = Math.max(0, (now - lastSeen.getTime()) / 86_400_000 - 1);
  return Math.round(army * 0.5 ** (days / DECAY_HALF_DAYS));
}

export function toRow(r: Row): TerritoryRow {
  return {
    regionId: r.regionId, name: r.name, kind: r.kind, lat: r.lat, lon: r.lon, pop: r.pop,
    nation: r.nation ? nationSummary(r.nation) : null,
    aiGovernor: r.aiGovernor as AiFaction, gov: r.gov as Gov,
    army: r.nation ? effectiveArmy(r.army, r.nation.player.lastSeenAt) : 0,
    support: r.support,
    takenAt: r.takenAt?.toISOString() ?? null,
    updatedAt: r.updatedAt.toISOString(),
  };
}

export const ROW_INCLUDE = { nation: { include: { player: { select: { lastSeenAt: true } } } } } as const;

export function toEvent(e: { id: number; at: Date; kind: string; text: string; regionId: string | null; nationId: string | null }): WorldEvent {
  return { id: e.id, at: e.at.toISOString(), kind: e.kind, text: e.text, regionId: e.regionId, nationId: e.nationId };
}

export function parseRegion(v: unknown): RegionInfo {
  const r = (v ?? {}) as Record<string, unknown>;
  return {
    id: regionId(r.id),
    name: str(r.name, "Region name", 80),
    kind: str(r.kind, "Region kind", 40),
    lat: num(r.lat, "Latitude", -90, 90),
    lon: num(r.lon, "Longitude", -180, 180),
    pop: num(r.pop, "Population", 0, 500),
    gov: oneOf(r.gov, "Government", GOVS),
  };
}

export function parseClaim(v: unknown): ClaimRequest {
  const c = (v ?? {}) as Record<string, unknown>;
  return {
    region: parseRegion(c.region),
    how: oneOf(c.how, "How", HOWS),
    previous: str(c.previous, "Previous governor", 80),
    army: Math.round(num(c.army, "Army", 0, MAX_ARMY)),
    support: num(c.support, "Support", 0, 1),
  };
}

/** `message` is the news phrase ("seizes power"); `you` tells the attacker what happened. */
export interface Contest { ok: boolean; message: string; you: string; attackerLeft: number; defenderLeft: number }

/**
 * A nation trying to take a region another nation holds. Elections go to the bigger share of
 * support; coups and wars are a roll weighted by the troops on each side (the defender fights
 * from prepared ground).
 */
export function resolveContest(how: ClaimRequest["how"], attacker: { army: number; support: number }, defender: { army: number; support: number }, roll: number): Contest {
  const A = attacker.army, D = defender.army;
  if (how === "election") {
    const ok = attacker.support > defender.support + 0.02;
    return { ok, message: ok ? "wins the election" : "loses the election", you: ok ? "You won the vote" : "You lost the vote", attackerLeft: A, defenderLeft: D };
  }
  if (A <= 0) return { ok: false, message: "has no troops there", you: "You have no troops there", attackerLeft: 0, defenderLeft: D };
  const d = D * 1.2;
  const p = how === "coup"
    ? Math.min(0.9, Math.max(0.05, 0.1 + 0.8 * A / (A + 1.5 * d)))
    : (A * A) / (A * A + d * d);
  const ok = roll < p;
  if (ok) return { ok, message: how === "coup" ? "seizes power" : "conquers it", you: how === "coup" ? "Your coup succeeded" : "Your army won", attackerLeft: Math.max(1, Math.round(A - D * 0.6 * Math.min(1, D / A))), defenderLeft: 0 };
  return { ok, message: how === "coup" ? "fails a coup" : "is beaten back", you: how === "coup" ? "Your coup failed" : "Your army was beaten back", attackerLeft: Math.round(A * 0.4), defenderLeft: Math.max(0, Math.round(D - A * 0.4)) };
}

async function recentClaims(nationId: string): Promise<number> {
  return db().allegianceEvent.count({ where: { nationId, kind: { in: ["take", "seize", "repelled"] }, at: { gt: new Date(Date.now() - 60_000) } } });
}

export async function claim(nation: AllegianceNation, req: ClaimRequest): Promise<{ response: Omit<ClaimResponse, "pushError">; event: WorldEvent | null }> {
  if ((await recentClaims(nation.id)) >= CLAIMS_PER_MINUTE) throw new ApiError(429, "rate", "Too many territory claims this minute.");
  const { region } = req;
  const previousAi = (AI_FACTIONS as readonly string[]).includes(req.previous) ? (req.previous as AiFaction) : null;
  return db().$transaction(async tx => {
    // Lock the row (or its absence) for the decision.
    await tx.$executeRaw`SELECT 1 FROM allegiance_territories WHERE "regionId" = ${region.id} FOR UPDATE`;
    const row = await tx.allegianceTerritory.findUnique({ where: { regionId: region.id }, include: ROW_INCLUDE });
    const base = { name: region.name, kind: region.kind, lat: region.lat, lon: region.lon, pop: region.pop, gov: region.gov };
    if (row?.nationId === nation.id) {
      const r = await tx.allegianceTerritory.update({ where: { regionId: region.id }, data: { army: req.army, support: req.support, gov: region.gov }, include: ROW_INCLUDE });
      return { response: { ok: true, message: `You already hold ${region.name}.`, row: toRow(r), army: req.army }, event: null };
    }
    if (!row || !row.nationId) {
      const aiGovernor = previousAi ?? (row?.aiGovernor as AiFaction | undefined) ?? "concordat";
      const data = { ...base, nationId: nation.id, aiGovernor, army: req.army, support: req.support, takenAt: new Date() };
      const r = row
        ? await tx.allegianceTerritory.update({ where: { regionId: region.id }, data, include: ROW_INCLUDE })
        : await tx.allegianceTerritory.create({ data: { regionId: region.id, ...data }, include: ROW_INCLUDE });
      const e = await tx.allegianceEvent.create({ data: { kind: "take", text: `${nation.name} takes ${region.name} (${req.how}).`, regionId: region.id, nationId: nation.id } });
      return { response: { ok: true, message: `${region.name} is yours.`, row: toRow(r), army: req.army }, event: toEvent(e) };
    }
    // Another nation holds it.
    const defender = row.nation!;
    const defArmy = effectiveArmy(row.army, defender.player.lastSeenAt);
    const result = resolveContest(req.how, { army: req.army, support: req.support }, { army: defArmy, support: row.support }, randomInt(1_000_000) / 1_000_000);
    if (result.ok) {
      const r = await tx.allegianceTerritory.update({
        where: { regionId: region.id },
        data: { ...base, nationId: nation.id, army: result.attackerLeft, support: req.support, takenAt: new Date() },
        include: ROW_INCLUDE,
      });
      const e = await tx.allegianceEvent.create({ data: { kind: "seize", text: `${nation.name} ${result.message} in ${region.name}, taking it from ${defender.name}!`, regionId: region.id, nationId: nation.id } });
      return { response: { ok: true, message: `${nation.name} ${result.message}: ${region.name} is taken from ${defender.name}.`, row: toRow(r), army: result.attackerLeft }, event: toEvent(e) };
    }
    const r = await tx.allegianceTerritory.update({ where: { regionId: region.id }, data: { army: result.defenderLeft }, include: ROW_INCLUDE });
    const e = await tx.allegianceEvent.create({ data: { kind: "repelled", text: `${defender.name} holds ${region.name}: ${nation.name} ${result.message}.`, regionId: region.id, nationId: nation.id } });
    return { response: { ok: false, message: `${defender.name} holds ${region.name}. ${result.you}.`, row: toRow(r), army: result.attackerLeft }, event: toEvent(e) };
  });
}

export async function release(nation: AllegianceNation, regionIdValue: string, to: AiFaction, why: string): Promise<{ row: TerritoryRow | null; event: WorldEvent | null }> {
  return db().$transaction(async tx => {
    const row = await tx.allegianceTerritory.findUnique({ where: { regionId: regionIdValue } });
    if (!row || row.nationId !== nation.id) throw new ApiError(409, "not-yours", "Your nation does not hold that territory.");
    const r = await tx.allegianceTerritory.update({ where: { regionId: regionIdValue }, data: { nationId: null, aiGovernor: to, army: 0, support: 0 }, include: ROW_INCLUDE });
    const e = await tx.allegianceEvent.create({ data: { kind: "fall", text: `${row.name} falls from ${nation.name}: ${why}.`, regionId: regionIdValue, nationId: nation.id } });
    return { row: toRow(r), event: toEvent(e) };
  });
}

/** Ends a nation: its territory returns to the regimes it was taken from. */
export async function endNation(nationId: string): Promise<TerritoryRow[]> {
  return db().$transaction(async tx => {
    const n = await tx.allegianceNation.update({ where: { id: nationId }, data: { active: false, endedAt: new Date() } });
    const held = await tx.allegianceTerritory.findMany({ where: { nationId } });
    await tx.allegianceTerritory.updateMany({ where: { nationId }, data: { nationId: null, army: 0, support: 0 } });
    if (held.length) await tx.allegianceEvent.create({ data: { kind: "dissolved", text: `${n.name} is dissolved; ${held.length} territories return to the regimes.`, nationId } });
    const rows = await tx.allegianceTerritory.findMany({ where: { regionId: { in: held.map(h => h.regionId) } }, include: ROW_INCLUDE });
    return rows.map(toRow);
  });
}

/** The client's periodic report of what it holds: troops and support are updated, differences returned. */
export async function report(nation: AllegianceNation, holdings: { id: string; army: number; support: number; gov: Gov }[]): Promise<{ rows: TerritoryRow[]; unknown: string[] }> {
  const ids = holdings.map(h => h.id);
  const [reported, unreported] = await Promise.all([
    db().allegianceTerritory.findMany({ where: { regionId: { in: ids } }, include: ROW_INCLUDE }),
    db().allegianceTerritory.findMany({ where: { nationId: nation.id, regionId: { notIn: ids } }, include: ROW_INCLUDE }),
  ]);
  const byId = new Map(reported.map(r => [r.regionId, r]));
  const differ: TerritoryRow[] = unreported.map(toRow);
  const unknown: string[] = [];
  const updates = [];
  for (const h of holdings) {
    const r = byId.get(h.id);
    if (!r) unknown.push(h.id);
    else if (r.nationId !== nation.id) differ.push(toRow(r));
    else if (r.army !== h.army || Math.abs(r.support - h.support) > 1e-4 || r.gov !== h.gov)
      updates.push(db().allegianceTerritory.update({ where: { regionId: h.id }, data: { army: h.army, support: h.support, gov: h.gov } }));
  }
  if (updates.length) await db().$transaction(updates);
  return { rows: differ, unknown };
}

export function parseHoldings(v: unknown): { id: string; army: number; support: number; gov: Gov }[] {
  if (!Array.isArray(v) || v.length > 5000) throw new ApiError(400, "invalid", "Holdings must be a list of at most 5000.");
  return v.map((h: Record<string, unknown>) => ({
    id: regionId(h?.id),
    army: Math.round(num(h?.army, "Army", 0, MAX_ARMY)),
    support: num(h?.support, "Support", 0, 1),
    gov: oneOf(h?.gov, "Government", GOVS),
  }));
}
