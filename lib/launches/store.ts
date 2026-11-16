// Visitor Launches: list the live ones, and launch a new one from a URL. A launch goes live as
// soon as it passes the checks below; `hidden` is the manual takedown.
import { createHash } from "node:crypto";
import { db } from "@/lib/allegiance/db";
import { fetchPage } from "./fetch-page";
import { parseMeta } from "./metadata";
import { bareHost, LaunchError, launchKey, listingUrl, parseLaunchUrl } from "./url";

export type LaunchView = {
  id: string;
  url: string;
  host: string;
  title: string;
  tagline: string | null;
  imageUrl: string | null;
  iconUrl: string | null;
  createdAt: string;
};

const LIST_LIMIT = 40;
const PER_IP_PER_DAY = 3;
const ALL_PER_HOUR = 120;
const DAY_MS = 24 * 3600_000;

/** Words that only ever show up on spam listings. Matched on whole words in host, title, tagline. */
const SPAM_WORDS = /\b(casino|betting|viagra|cialis|porn|xxx|escort|payday loan|replica watches|crypto giveaway|airdrop claim|followers cheap)\b/i;

type Row = { id: string; url: string; host: string; title: string; tagline: string | null; imageUrl: string | null; iconUrl: string | null; createdAt: Date };

function view(r: Row): LaunchView {
  return { id: r.id, url: r.url, host: r.host, title: r.title, tagline: r.tagline, imageUrl: r.imageUrl, iconUrl: r.iconUrl, createdAt: r.createdAt.toISOString() };
}

export function hashIp(ip: string): string {
  return createHash("sha256").update(`${process.env.LAUNCHES_SALT ?? "indie-machine-launches"}:${ip}`).digest("hex");
}

export async function listLaunches(): Promise<LaunchView[]> {
  const rows = await db().visitorLaunch.findMany({ where: { hidden: false }, orderBy: { createdAt: "desc" }, take: LIST_LIMIT });
  return rows.map(view);
}

async function existing(key: string) {
  return db().visitorLaunch.findUnique({ where: { key } });
}

function duplicate(r: { title: string }): LaunchError {
  return new LaunchError(409, "duplicate", `${r.title} is already launched here. One listing per product.`);
}

export async function launch(input: unknown, ip: string): Promise<LaunchView> {
  const url = parseLaunchUrl(input);

  // Cheap checks first: a duplicate or a rate-limited visitor never costs us a fetch.
  const known = await existing(launchKey(url));
  if (known) throw duplicate(known);
  const ipHash = hashIp(ip);
  const now = Date.now();
  const [mine, everyone] = await Promise.all([
    db().visitorLaunch.count({ where: { ipHash, createdAt: { gt: new Date(now - DAY_MS) } } }),
    db().visitorLaunch.count({ where: { createdAt: { gt: new Date(now - 3600_000) } } }),
  ]);
  if (mine >= PER_IP_PER_DAY) throw new LaunchError(429, "rate-limit", `That's ${PER_IP_PER_DAY} launches from you today. Come back tomorrow.`);
  if (everyone >= ALL_PER_HOUR) throw new LaunchError(429, "busy", "Launches are busy right now. Try again in a few minutes.");

  const page = await fetchPage(url);
  // A redirect can land on a different product (or one already listed): key on where it ended up.
  const finalKey = launchKey(page.finalUrl);
  if (finalKey !== launchKey(url)) {
    const known2 = await existing(finalKey);
    if (known2) throw duplicate(known2);
  }

  const meta = parseMeta(page.html, page.finalUrl);
  const host = bareHost(page.finalUrl.hostname);
  if (!meta.title) throw new LaunchError(400, "no-title", "That page has no title. Add a <title> or og:title and try again.");
  if (SPAM_WORDS.test(`${host} ${meta.title} ${meta.tagline ?? ""}`)) throw new LaunchError(400, "blocked", "That listing looks like spam, so it wasn't launched.");

  try {
    const row = await db().visitorLaunch.create({
      data: { key: finalKey, url: listingUrl(page.finalUrl), host, title: meta.title, tagline: meta.tagline, imageUrl: meta.imageUrl, iconUrl: meta.iconUrl, ipHash },
    });
    return view(row);
  } catch (e) {
    // Two launches of the same product racing each other: the unique key lets one through.
    if ((e as { code?: string }).code === "P2002") throw new LaunchError(409, "duplicate", "That product was just launched by someone else.");
    throw e;
  }
}

/** Manual takedown. The key stays taken, so the same product can't be relaunched. */
export async function hideLaunch(id: string): Promise<boolean> {
  const r = await db().visitorLaunch.updateMany({ where: { id }, data: { hidden: true } });
  return r.count > 0;
}
