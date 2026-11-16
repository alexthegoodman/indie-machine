// URL checks and the duplicate key for Visitor Launches. The key is the bare host, except on
// hosts that list many different products, where the path tells them apart.

export class LaunchError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

/** Hosts where one domain holds many products: key on host + path. */
const SHARED_HOSTS = new Set([
  "github.com",
  "gitlab.com",
  "codeberg.org",
  "bitbucket.org",
  "huggingface.co",
  "store.steampowered.com",
  "apps.apple.com",
  "play.google.com",
  "chromewebstore.google.com",
  "addons.mozilla.org",
  "marketplace.visualstudio.com",
  "npmjs.com",
  "crates.io",
  "pypi.org",
  "itch.io",
  "gumroad.com",
  "notion.site",
]);

/** Link shorteners and redirectors hide where a listing goes. */
const BLOCKED_HOSTS = new Set([
  "bit.ly", "t.co", "tinyurl.com", "goo.gl", "ow.ly", "is.gd", "buff.ly", "cutt.ly",
  "rebrand.ly", "shorturl.at", "rb.gy", "t.ly", "lnkd.in", "linktr.ee", "tiny.cc",
  "indie-machine.com",
]);

export function isSharedHost(host: string): boolean {
  return SHARED_HOSTS.has(host);
}

export function bareHost(hostname: string): string {
  return hostname.toLowerCase().replace(/\.$/, "").replace(/^www\./, "");
}

function isIpLiteral(host: string): boolean {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(":") || host.startsWith("[");
}

/** Parses what the visitor typed. Adds https:// when they left the scheme off. */
export function parseLaunchUrl(input: unknown): URL {
  if (typeof input !== "string") throw new LaunchError(400, "invalid", "Paste your product's URL.");
  const raw = input.trim();
  if (!raw || raw.length > 500) throw new LaunchError(400, "invalid", "Paste your product's URL.");
  let url: URL;
  try {
    url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    throw new LaunchError(400, "invalid", "That doesn't look like a URL.");
  }
  checkUrl(url);
  return url;
}

/** Rejects anything that is not a plain public web address. Runs on every redirect hop too. */
export function checkUrl(url: URL): void {
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new LaunchError(400, "invalid", "Only http and https links can be launched.");
  if (url.username || url.password) throw new LaunchError(400, "invalid", "Links with a username or password can't be launched.");
  const host = bareHost(url.hostname);
  if (isIpLiteral(host) || !host.includes(".") || host.endsWith(".local") || host.endsWith(".internal") || host === "localhost")
    throw new LaunchError(400, "invalid", "Use your product's public domain, not an IP address or local name.");
  if (url.port && url.port !== "80" && url.port !== "443") throw new LaunchError(400, "invalid", "Links on a custom port can't be launched.");
  if (BLOCKED_HOSTS.has(host) || [...BLOCKED_HOSTS].some(b => host.endsWith(`.${b}`)))
    throw new LaunchError(400, "blocked", "Link shorteners can't be launched. Use the product's own URL.");
}

/** The duplicate key: "acme.dev", or "github.com/acme/widget" on a shared host. */
export function launchKey(url: URL): string {
  const host = bareHost(url.hostname);
  if (!SHARED_HOSTS.has(host)) return host;
  const path = url.pathname.toLowerCase().replace(/\/+$/, "");
  if (host === "play.google.com") return `${host}${path}?id=${(url.searchParams.get("id") ?? "").toLowerCase()}`;
  return `${host}${path}`;
}

/** What the listing links to: the page the visitor gave, minus tracking query and hash. */
export function listingUrl(url: URL): string {
  const out = new URL(url.href);
  out.hash = "";
  const id = bareHost(out.hostname) === "play.google.com" ? out.searchParams.get("id") : null;
  out.search = id ? `?id=${encodeURIComponent(id)}` : "";
  return out.href;
}
