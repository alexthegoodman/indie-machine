import fs from "fs";
import path from "path";

// Fonts for next/og's ImageResponse (satori) are bundled in the repo and
// read from disk rather than fetched from Google Fonts at build/render time.
// Fetching them per-request/per-prerender used to work in local `next dev`
// but failed intermittently during deploy prerendering - Google Fonts'
// CSS API serves a format based on the request's User-Agent (woff2 to
// modern clients, which satori can't parse), and build sandboxes can also
// rate-limit or restrict outbound requests across the several post pages
// prerendered at once. Reading local files sidesteps both failure modes.
const FONTS_DIR = path.join(process.cwd(), "assets/fonts");

function readFont(filename: string): Buffer {
  return fs.readFileSync(path.join(FONTS_DIR, filename));
}

export async function loadOgFonts() {
  return [
    { name: "Space Grotesk", data: readFont("SpaceGrotesk-Bold.woff"), weight: 700 as const, style: "normal" as const },
    { name: "Space Grotesk", data: readFont("SpaceGrotesk-Medium.woff"), weight: 500 as const, style: "normal" as const },
    { name: "IBM Plex Mono", data: readFont("IBMPlexMono-Medium.woff"), weight: 500 as const, style: "normal" as const },
  ];
}
