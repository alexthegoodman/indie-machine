import Link from "next/link";
import { AdSlot } from "@/components/AdSlot";
import { FreeAiBanner } from "@/components/free-ai/FreeAiBanner";
import { Billboard } from "@/components/media/Billboard";
import { ContinueShelf, HomeFeed } from "@/components/media/HomeFeed";
import { PageBody, ShelfHeader } from "@/components/media/ChannelHeader";
import { Thumb } from "@/components/media/Thumb";
import { ScoreMeter } from "@/components/ScoreMeter";
import { getAllPosts } from "@/lib/posts";
import { toMediaItem, type MediaItem } from "@/lib/media";
import { YumonThreads } from "@/components/free-ai/YumonThreads";

const TOP_COUNT = 5;

function firstWithImage(items: MediaItem[], kind: MediaItem["kind"]) {
  return items.find((i) => i.kind === kind && i.image);
}

export default function Home() {
  const items = getAllPosts().map(toMediaItem);
  const featured = [
    firstWithImage(items, "product"),
    firstWithImage(items, "dev"),
    firstWithImage(items, "game"),
  ].filter((i): i is MediaItem => !!i);
  const topScored = items
    .filter((i) => i.kind === "product" && i.score !== undefined)
    .sort((a, b) => b.score! - a.score!)
    .slice(0, TOP_COUNT);
  const games = items.filter((i) => i.kind === "game").slice(0, 10);

  return (
    <PageBody className="pb-4">
      <h1 className="sr-only">Indie Machine - developer tools tested from source, and a Rust build log</h1>

      {/* <FreeAiBanner /> */}

      {/* To benefit those coming from getfreeai.online, which would be most of the home page visitors, this is included directly */}
      <div className="mb-8">
        <YumonThreads />
      </div>

      <Billboard items={featured} />
      <ContinueShelf />

      <div className="mt-8">
        <HomeFeed items={items} />
      </div>

      {topScored.length > 0 && (
        <section aria-label="Top scored" className="mt-14">
          <ShelfHeader kicker="// LEADERBOARD" title="Top scored reviews" href="/products?sort=score" linkLabel="FULL LEADERBOARD" />
          <ol className="grid grid-cols-[repeat(auto-fill,minmax(210px,1fr))] gap-px border border-line/22 bg-line/22">
            {topScored.map((item, i) => (
              <li key={item.slug} className="group relative flex flex-col gap-2 bg-ink p-4 hover:bg-panel/55">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-display text-[26px] font-bold text-accent">{String(i + 1).padStart(2, "0")}</span>
                  <span className="text-[15px] text-ink-100">{item.score!.toFixed(1)}</span>
                </div>
                <Link
                  href={`/posts/${item.slug}`}
                  className="line-clamp-2 font-display text-[15px] leading-snug font-semibold text-ink-100! after:absolute after:inset-0 after:content-[''] group-hover:text-accent!"
                >
                  {item.title.split(" Review")[0]}
                </Link>
                <ScoreMeter value={item.score!} />
                <p className="line-clamp-2 text-[11px] leading-relaxed text-ink-400">{item.blurb}</p>
              </li>
            ))}
          </ol>
        </section>
      )}

      {games.length > 0 && (
        <section aria-label="Game announcements" className="mt-14">
          <ShelfHeader
            kicker="// CURATED INDIE GAMES"
            title="New games worth a look"
            href="/announcements"
            linkLabel="ALL ANNOUNCEMENTS"
            accent="badge"
          />
          <div className="shelf flex gap-4 overflow-x-auto pb-3">
            {games.map((item) => (
              <article key={item.slug} className="group relative flex w-[280px] shrink-0 flex-col gap-2.5">
                <Thumb item={item} className="group-hover:border-badge/60" />
                <Link
                  href={`/posts/${item.slug}`}
                  className="line-clamp-2 font-display text-[15px] leading-snug font-semibold text-ink-100! after:absolute after:inset-0 after:content-[''] group-hover:text-badge!"
                >
                  {item.title.split(" Announcement")[0]}
                </Link>
                <ul className="flex flex-wrap gap-1.5" aria-label="Impression badges">
                  {item.badges?.slice(0, 2).map((b) => (
                    <li
                      key={b}
                      className="border border-badge/60 bg-badge/10 px-1.5 py-0.5 text-[10px] font-semibold tracking-[0.06em] text-badge uppercase"
                    >
                      ◆ {b}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>
      )}

      <div className="mt-14 grid gap-5 xl:grid-cols-2">
        <section aria-label="Free AI" className="flex flex-wrap border border-accent/40 bg-panel/20">
          <div className="flex min-w-0 flex-[999_1_300px] flex-col gap-3 p-6">
            <div className="text-[11px] tracking-[0.14em] text-accent">// FREE AI · RUNS IN YOUR BROWSER</div>
            <h2 className="font-display text-2xl font-bold text-ink-100">Chat with Yumon, right on your device</h2>
            <p className="font-display text-[15px] leading-relaxed text-ink-300">
              A 27M-parameter model that runs on WebGPU in your browser. No account, no server. Your threads are
              saved in your browser and nowhere else.
            </p>
            <div>
              <Link
                href="/free-ai"
                className="inline-flex h-11 items-center bg-accent px-5 font-display text-[13px] font-semibold tracking-[0.08em] text-ink! hover:bg-ink-100"
              >
                TRY FREE AI
              </Link>
            </div>
          </div>
          <Link href="/free-ai" tabIndex={-1} aria-hidden="true" className="block max-h-64 min-w-0 flex-[1_1_240px] overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/free-ai-yumon-threads.png" alt="" className="h-full w-full object-cover object-left-top" />
          </Link>
        </section>

        <section aria-label="Play games" className="flex flex-wrap border border-line/32">
          <div className="flex min-w-0 flex-[999_1_300px] flex-col gap-3 p-6">
            <div className="text-[11px] tracking-[0.14em] text-accent">// NOW LIVE</div>
            <h2 className="font-display text-2xl font-bold text-ink-100">Allegiance, our online conquest MMO</h2>
            <p className="font-display text-[15px] leading-relaxed text-ink-300">
              Found a nation and contest territory in a shared world, right in the browser. Built with Babylon.js
              and Cloudflare Durable Objects.
            </p>
            <div>
              <Link
                href="/games"
                className="inline-flex h-11 items-center border border-accent/60 px-5 text-xs tracking-[0.12em] hover:bg-accent/10"
              >
                PLAY GAMES
              </Link>
            </div>
          </div>
          <Link href="/games" tabIndex={-1} aria-hidden="true" className="block max-h-64 min-w-0 flex-[1_1_240px] overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/allegiance-babylon-street.png" alt="" className="h-full w-full object-cover" />
          </Link>
        </section>
      </div>

      <AdSlot placement="home" className="mt-14" />
    </PageBody>
  );
}
