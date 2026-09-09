// Loads the site's Google Fonts as raw font data for next/og's ImageResponse
// (satori) - it can't consume next/font's build-time CSS vars, so OG routes
// fetch the same two families directly and pass them in via the `fonts`
// option.
async function fetchFont(family: string, weight: number): Promise<ArrayBuffer> {
  const cssUrl = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@${weight}`;
  const css = await (await fetch(cssUrl)).text();
  const match = css.match(/src: url\(([^)]+)\)/);
  if (!match) throw new Error(`no font src found for ${family}:${weight}`);
  const res = await fetch(match[1]);
  if (!res.ok) throw new Error(`failed to fetch font file for ${family}:${weight}`);
  return res.arrayBuffer();
}

export async function loadOgFonts() {
  const [displayBold, displayMedium, mono] = await Promise.all([
    fetchFont("Space Grotesk", 700),
    fetchFont("Space Grotesk", 500),
    fetchFont("IBM Plex Mono", 500),
  ]);

  return [
    { name: "Space Grotesk", data: displayBold, weight: 700 as const, style: "normal" as const },
    { name: "Space Grotesk", data: displayMedium, weight: 500 as const, style: "normal" as const },
    { name: "IBM Plex Mono", data: mono, weight: 500 as const, style: "normal" as const },
  ];
}
