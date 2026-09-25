// Single source of truth for the site's canonical origin. Sitemap, robots.txt,
// metadataBase, and per-post structured data all resolve absolute URLs from
// this. The public domain is the default so local and preview builds still
// point search engines to the same published URLs.
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://indie-machine.com").replace(/\/+$/, "");

export const SITE_NAME = "Indie Machine";
export const SITE_DESCRIPTION =
  "Indie Machine documents Rust and native software development through tested builds, source code, measurements, and practical notes on Entropy and Yumon.";

export const SITE_TITLE = "Indie Machine | Rust and Native Software Engineering";

export function absoluteUrl(path: string): string {
  return new URL(path, `${SITE_URL}/`).toString();
}
