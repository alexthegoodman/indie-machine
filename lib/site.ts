// Single source of truth for the site's canonical origin. Sitemap, robots.txt,
// metadataBase, and per-post structured data all resolve absolute URLs from
// this. The public domain is the default so local and preview builds still
// point search engines to the same published URLs.
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://indie-machine.com").replace(/\/+$/, "");

export const SITE_NAME = "Indie Machine";
export const SITE_DESCRIPTION =
  "Indie Machine reviews developer tools and AI agents from their source code, with reproducible tests and scorecards, alongside a Rust build log for the Entropy engine and Yumon.";

export const SITE_TITLE = "Indie Machine | Developer Tool Reviews and Rust Engineering";

// Where /promote's "submit a product" mailto goes.
export const CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL || "reviews@indie-machine.com";

export function absoluteUrl(path: string): string {
  return new URL(path, `${SITE_URL}/`).toString();
}
