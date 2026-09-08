// Single source of truth for the site's canonical origin. Sitemap, robots.txt,
// metadataBase, and per-post structured data all resolve absolute URLs from
// this - set NEXT_PUBLIC_SITE_URL in the deploy environment once the real
// domain exists, otherwise this falls back to localhost for local builds.
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const SITE_NAME = "Indie Machine";
export const SITE_DESCRIPTION =
  "Indie Machine is a build log for Entropy, a native engine written from scratch in Rust — GPU compute pipelines, an in-house GUI kit, and everything measured against a real commit.";
