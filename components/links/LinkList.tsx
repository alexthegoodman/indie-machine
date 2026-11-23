import Link from "next/link";
import { ExternalIcon } from "@/components/shell/icons";
import { LINK_TOPICS, linksByDay, outboundRel, type LinkSummary, type LinkTopic } from "@/lib/links";
import { shortDate } from "@/lib/media";

export function TopicChip({ topic, active = false }: { topic: LinkTopic; active?: boolean }) {
  return (
    <Link
      href={`/links/topic/${topic}`}
      aria-current={active ? "page" : undefined}
      className={`inline-flex h-7 items-center border px-2.5 text-[10px] font-semibold tracking-[0.12em] uppercase ${
        active ? "border-accent bg-accent/15 text-accent!" : "border-line/28 text-ink-300! hover:border-accent hover:text-accent!"
      }`}
    >
      {LINK_TOPICS[topic].label}
    </Link>
  );
}

export function TopicNav({ active }: { active?: LinkTopic }) {
  return (
    <nav aria-label="Link topics" className="flex flex-wrap gap-2">
      <Link
        href="/links"
        aria-current={!active ? "page" : undefined}
        className={`inline-flex h-7 items-center border px-2.5 text-[10px] font-semibold tracking-[0.12em] uppercase ${
          !active ? "border-accent bg-accent/15 text-accent!" : "border-line/28 text-ink-300! hover:border-accent hover:text-accent!"
        }`}
      >
        All
      </Link>
      {(Object.keys(LINK_TOPICS) as LinkTopic[]).map((t) => (
        <TopicChip key={t} topic={t} active={t === active} />
      ))}
    </nav>
  );
}

export function LinkRow({ link }: { link: LinkSummary }) {
  return (
    <li className="border-t border-line/14 py-5 first:border-t-0" data-link-slug={link.slug}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] tracking-[0.06em] text-ink-500">
        <TopicChip topic={link.topic} />
        <span>{link.source}</span>
        <span aria-hidden>·</span>
        <span>{link.host}</span>
      </div>
      <h3 className="mt-2.5 font-display text-xl leading-snug font-bold text-ink-100">
        <Link href={`/links/${link.slug}`} className="text-ink-100! hover:text-accent!">
          {link.title}
        </Link>
      </h3>
      <p className="mt-2 max-w-3xl font-display text-[15px] leading-relaxed text-ink-300">{link.excerpt}</p>
      <div className="mt-3 flex flex-wrap items-center gap-4 text-[11px] tracking-[0.12em]">
        <Link href={`/links/${link.slug}`}>OUR TAKE -&gt;</Link>
        <a href={link.url} target="_blank" rel={outboundRel(link)} className="inline-flex items-center gap-1.5">
          READ AT {link.source.toUpperCase()} <ExternalIcon size={13} />
        </a>
      </div>
    </li>
  );
}

// The feed: one block per day, newest first.
export function LinkFeed({ links }: { links: LinkSummary[] }) {
  if (!links.length) return <p className="py-10 text-ink-400">No links here yet.</p>;
  return (
    <div className="flex flex-col gap-8" data-track-area="Trending links">
      {linksByDay(links).map(({ date, links }) => (
        <section key={date} aria-labelledby={`day-${date}`}>
          <h2 id={`day-${date}`} className="border-b border-dashed border-line/22 pb-2 text-[11px] tracking-[0.14em] text-accent">
            <time dateTime={date}>{shortDate(date).toUpperCase()}</time>
            <span className="ml-3 text-ink-500">{links.length} LINKS</span>
          </h2>
          <ul>
            {links.map((l) => (
              <LinkRow key={l.slug} link={l} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
