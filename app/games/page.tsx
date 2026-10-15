import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { SectionDivider } from "@/components/SectionDivider";
import { TitleBlock } from "@/components/TitleBlock";
import { ChevronRight } from "@/components/icons";
import { SITE_NAME } from "@/lib/site";

const ALLEGIANCE_URL = "https://allegiance.indie-machine.com";

export const metadata: Metadata = {
  title: "Play Games | Indie Machine",
  description: "Games built in-house by the Indie Machine team. Play Allegiance, an online political conquest MMO, in your browser.",
  alternates: { canonical: "/games" },
  openGraph: {
    title: `Play Games | ${SITE_NAME}`,
    description: "Games built in-house by the Indie Machine team.",
    url: "/games",
    siteName: SITE_NAME,
    type: "website",
    images: ["/opengraph-image"],
  },
  twitter: {
    card: "summary_large_image",
    title: `Play Games | ${SITE_NAME}`,
    description: "Games built in-house by the Indie Machine team.",
    images: ["/opengraph-image"],
  },
};

const SHOTS = [
  {
    src: "/images/allegiance/title.png",
    alt: "Allegiance title screen over a view of Earth, with New Nation / New Party and Continue buttons",
    caption: "The title screen. Start a new nation or continue a saved one.",
  },
  {
    src: "/images/allegiance/london.png",
    alt: "Allegiance street view in London with another player standing beside a hover car, HUD showing party status, minimap and nearby locations",
    caption: "Two players meet in London.",
  },
  {
    src: "/images/allegiance/territory-contest.png",
    alt: "Allegiance after a failed attack on London, with notices that the Iron Choir held the city and seized it",
    caption: "A contested city.",
  },
];

export default function GamesPage() {
  return (
    <div className="relative z-10">
      <SiteHeader active="games" />

      <div className="px-6 pt-16 pb-8 md:px-24 md:pt-20">
        <div className="text-[13px] tracking-[0.14em] text-accent">// HOMEGROWN GAMES</div>
        <h1 className="mt-3 font-display text-5xl font-bold text-ink-100 md:text-6xl">Play Games</h1>
        <p className="mt-6 max-w-2xl font-display text-base leading-relaxed text-ink-300 md:text-lg">
          Games we build ourselves, with the same tools we review and write about. They run in the
          browser, no install needed.
        </p>
        <div className="mt-10">
          <TitleBlock
            cells={[
              { label: "GAMES", value: "001" },
              { label: "PLATFORM", value: "BROWSER" },
              { label: "STATUS", value: "LIVE", accent: true },
            ]}
          />
        </div>
      </div>

      <SectionDivider label="SCREENSHOTS" />

      <div className="px-6 pb-16 md:px-24">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {SHOTS.map((shot) => (
            <figure key={shot.src}>
              <img src={shot.src} alt={shot.alt} width={1280} height={720} loading="lazy" className="w-full border border-line/28" />
              <figcaption className="mt-2 text-xs leading-relaxed text-ink-500">{shot.caption}</figcaption>
            </figure>
          ))}
        </div>
      </div>

      <SectionDivider label="NOW PLAYING" />

      <div className="px-6 pb-16 md:px-24">
        <div className="border border-accent/50 p-6 md:p-10">
          <div className="text-[11px] tracking-[0.14em] text-accent">// ONLINE MMO</div>
          <h2 className="mt-2 font-display text-3xl font-bold text-ink-100 md:text-4xl">Allegiance</h2>
          <p className="mt-4 max-w-2xl font-display text-[15px] leading-relaxed text-ink-300 md:text-base">
            A political conquest game on the full-scale Earth of 2100. Found a nation, join a party,
            claim territory and contest it against other players in a shared world. Built with
            Babylon.js and Vite, with realtime rooms running on Cloudflare Durable Objects.
          </p>
          <p className="mt-3 max-w-2xl font-display text-[15px] leading-relaxed text-ink-300 md:text-base">
            Allegiance is online-only. If the servers are unreachable, the game says so rather than
            falling back to a local mode.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-x-8 gap-y-3">
            <a
              href={ALLEGIANCE_URL}
              target="_blank"
              rel="noopener"
              className="flex items-center gap-2 text-sm tracking-wide text-accent hover:text-ink-100"
            >
              PLAY ALLEGIANCE <ChevronRight />
            </a>
            <Link href="/dev" className="text-xs tracking-[0.14em] text-ink-500 hover:text-ink-100">
              READ THE BUILD LOG →
            </Link>
          </div>
        </div>
      </div>

      

      <SiteFooter />
    </div>
  );
}
