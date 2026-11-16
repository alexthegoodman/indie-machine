// Pulls a listing's name, tagline, image and icon out of a page's <head>. Regex over the head
// only: no DOM, and nothing from the page is ever rendered as HTML.
import { bareHost, isSharedHost } from "./url";

export type PageMeta = { title: string | null; tagline: string | null; imageUrl: string | null; iconUrl: string | null };

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", "#39": "'", mdash: "-", ndash: "-", hellip: "..." };

function decode(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => safeChar(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => safeChar(parseInt(d, 10)))
    .replace(/&([a-z0-9#]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m);
}

function safeChar(code: number): string {
  try {
    return String.fromCodePoint(code);
  } catch {
    return "";
  }
}

/** Collapses whitespace, strips control characters, and cuts to `max` on a word boundary. */
export function clean(s: string | null | undefined, max: number): string | null {
  if (!s) return null;
  // eslint-disable-next-line no-control-regex
  let t = decode(s).replace(/[\u0000-\u001f\u007f​-‏‪-‮]/g, " ").replace(/\s+/g, " ").trim();
  if (!t) return null;
  if (t.length > max) t = `${t.slice(0, max - 3).replace(/\s+\S*$/, "")}...`;
  return t;
}

function attrs(tag: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of tag.matchAll(/([a-zA-Z:_-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)) out[m[1].toLowerCase()] = m[2] ?? m[3] ?? m[4] ?? "";
  return out;
}

function absolute(href: string | undefined, base: URL): string | null {
  if (!href) return null;
  try {
    const u = new URL(decode(href.trim()), base);
    // https only: the bar is served over https and an http image would be blocked as mixed content.
    return u.protocol === "https:" && u.href.length <= 1000 ? u.href : null;
  } catch {
    return null;
  }
}

export function parseMeta(html: string, base: URL): PageMeta {
  const end = html.search(/<\/head>/i);
  const head = end >= 0 ? html.slice(0, end) : html.slice(0, 200_000);
  const meta = new Map<string, string>();
  for (const m of head.matchAll(/<meta\b[^>]*>/gi)) {
    const a = attrs(m[0]);
    const name = (a.property ?? a.name ?? "").toLowerCase();
    if (name && a.content && !meta.has(name)) meta.set(name, a.content);
  }
  const icons: { href: string; rel: string; size: number }[] = [];
  for (const m of head.matchAll(/<link\b[^>]*>/gi)) {
    const a = attrs(m[0]);
    const rel = (a.rel ?? "").toLowerCase();
    if (!a.href || !/(^|\s)(icon|apple-touch-icon)(\s|$)/.test(rel)) continue;
    icons.push({ href: a.href, rel, size: parseInt(a.sizes ?? "", 10) || (rel.includes("apple") ? 180 : 16) });
  }
  // Closest to 64px wins: big enough to look sharp at 20-28px, small enough to load fast.
  icons.sort((x, y) => Math.abs(x.size - 64) - Math.abs(y.size - 64));
  const titleTag = head.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  const siteName = meta.get("og:site_name")?.trim();
  let pageTitle = (meta.get("og:title") ?? meta.get("twitter:title") ?? titleTag)?.trim();
  if (siteName && pageTitle && pageTitle.length > siteName.length + 3) {
    const esc = siteName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const branded = new RegExp(`^${esc}\\s*[-|:\u00b7\u2013\u2014]\\s*|\\s*[-|:\u00b7\u2013\u2014]\\s*${esc}$`, "i");
    // "Acme - ship faster" names the product Acme. On a host that lists many products the site
    // name is the host's ("GitHub - vercel/next.js"), so the rest of the title is the product.
    if (branded.test(pageTitle)) pageTitle = isSharedHost(bareHost(base.hostname)) ? pageTitle.replace(branded, "") : siteName;
  }
  return {
    title: clean(pageTitle || siteName, 80),
    tagline: clean(meta.get("og:description") ?? meta.get("twitter:description") ?? meta.get("description"), 160),
    imageUrl: absolute(meta.get("og:image") ?? meta.get("og:image:url") ?? meta.get("twitter:image") ?? meta.get("twitter:image:src"), base),
    iconUrl: absolute(icons[0]?.href ?? "/favicon.ico", base),
  };
}
