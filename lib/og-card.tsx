// Shared visual for every generated OG image (site-wide + per-post). Kept as
// a plain function returning JSX, not a component - it's fed straight into
// `next/og`'s ImageResponse (satori), which only understands a CSS subset:
// every multi-child node needs an explicit `display`, and layout is
// flexbox-only (no CSS grid, no gap - use margins).

const COLOR = {
  ink: "#0b1f3a",
  accent: "#4fd8ff",
  ink100: "#f3f8fc",
  ink300: "#b9d2e6",
  ink500: "#6f93b8",
  line: "rgba(219,234,254,0.25)",
};

function CrosshairMark() {
  return (
    <div style={{ position: "relative", width: 30, height: 30, display: "flex" }}>
      <div
        style={{
          position: "absolute",
          left: 7,
          top: 7,
          width: 16,
          height: 16,
          borderRadius: 8,
          border: `1.5px solid ${COLOR.accent}`,
          display: "flex",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 14.25,
          width: 30,
          height: 1.5,
          background: COLOR.accent,
          display: "flex",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 14.25,
          top: 0,
          width: 1.5,
          height: 30,
          background: COLOR.accent,
          display: "flex",
        }}
      />
    </div>
  );
}

function Chip({ children, tone = "line" }: { children: string; tone?: "line" | "accent" }) {
  return (
    <div
      style={{
        display: "flex",
        border: `1px solid ${tone === "accent" ? COLOR.accent : COLOR.line}`,
        padding: "6px 14px",
        fontSize: 15,
        letterSpacing: 2,
        color: tone === "accent" ? COLOR.accent : COLOR.ink300,
        fontFamily: "IBM Plex Mono",
      }}
    >
      {children.toUpperCase()}
    </div>
  );
}

export function OgCard({
  kicker,
  title,
  dek,
  footerLeft,
  footerRight,
}: {
  kicker: string;
  title: string;
  dek?: string;
  footerLeft: string;
  footerRight: string;
}) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        background: COLOR.ink,
        padding: "56px 68px",
        fontFamily: "IBM Plex Mono",
      }}
    >
      {/* header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center" }}>
          <CrosshairMark />
          <span
            style={{
              marginLeft: 12,
              fontSize: 22,
              letterSpacing: 4,
              color: COLOR.ink100,
              fontWeight: 500,
            }}
          >
            INDIE&nbsp;/&nbsp;MACHINE
          </span>
        </div>
        <Chip tone="accent">{kicker}</Chip>
      </div>

      {/* body */}
      <div style={{ display: "flex", flexDirection: "column", maxWidth: 1000 }}>
        <div
          style={{
            display: "flex",
            fontFamily: "Space Grotesk",
            fontWeight: 700,
            fontSize: title.length > 60 ? 52 : 64,
            lineHeight: 1.08,
            letterSpacing: -1,
            color: COLOR.ink100,
          }}
        >
          {title}
        </div>
        {dek && (
          <div
            style={{
              display: "flex",
              marginTop: 20,
              fontFamily: "Space Grotesk",
              fontSize: 24,
              lineHeight: 1.4,
              color: COLOR.ink300,
              maxWidth: 880,
            }}
          >
            {dek}
          </div>
        )}
      </div>

      {/* footer */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderTop: `1px solid ${COLOR.line}`,
          paddingTop: 24,
          fontSize: 16,
          letterSpacing: 1.5,
          color: COLOR.ink500,
        }}
      >
        <span style={{ display: "flex" }}>{footerLeft.toUpperCase()}</span>
        <span style={{ display: "flex" }}>{footerRight.toUpperCase()}</span>
      </div>
    </div>
  );
}

export const OG_SIZE = { width: 1200, height: 630 };
export const OG_CONTENT_TYPE = "image/png";

// Post excerpts (up to 220 chars, see lib/posts.ts) can run past what fits
// in the card's 3-line dek at this font size/width - re-truncate defensively
// rather than let a long one spill past the footer.
export function truncateForOg(text: string, maxLen = 170): string {
  if (text.length <= maxLen) return text;
  const cut = text.slice(0, maxLen);
  const boundary = cut.lastIndexOf(" ");
  return (boundary > 0 ? cut.slice(0, boundary) : cut) + "…";
}
