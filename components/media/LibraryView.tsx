"use client";

import Link from "next/link";
import type { MediaItem } from "@/lib/media";
import { clearHistory, useLibrary } from "@/lib/library";
import { useShell } from "@/components/shell/ShellContext";
import { MediaRow, SaveButton } from "./MediaCard";

export function LibraryView() {
  const { bySlug, toast } = useShell();
  const library = useLibrary();
  const resolve = (slugs: string[]) => slugs.map((s) => bySlug.get(s)).filter((i): i is MediaItem => !!i);
  const saved = resolve(library.saved);
  const history = resolve(library.history);

  return (
    <div className="mt-8 grid items-start gap-10 xl:grid-cols-2">
      <section aria-labelledby="saved-heading">
        <h2 id="saved-heading" className="mb-3 font-display text-lg font-semibold text-ink-100">
          Saved for later <span className="text-sm text-accent">{saved.length}</span>
        </h2>
        {saved.length === 0 ? (
          <p className="border border-dashed border-line/28 p-6 text-[13px] leading-relaxed text-ink-300">
            Nothing saved yet. Use the bookmark on any card, or SAVE on a post, to queue it here.
          </p>
        ) : (
          <ul className="flex flex-col gap-1">
            {saved.map((item) => (
              <li key={item.slug} className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <MediaRow item={item} thumbClass="w-44" />
                </div>
                <SaveButton slug={item.slug} className="h-11! w-11! shrink-0" />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="history-heading">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 id="history-heading" className="font-display text-lg font-semibold text-ink-100">
            Reading history
          </h2>
          {history.length > 0 && (
            <button
              type="button"
              onClick={() => {
                clearHistory();
                toast("History cleared");
              }}
              className="min-h-11 cursor-pointer text-[11px] tracking-[0.14em] text-accent hover:text-ink-100"
            >
              CLEAR HISTORY
            </button>
          )}
        </div>
        {history.length === 0 ? (
          <p className="border border-dashed border-line/28 p-6 text-[13px] leading-relaxed text-ink-300">
            Posts you open show up here with how far you got. <Link href="/">Browse the latest</Link>.
          </p>
        ) : (
          <ul className="flex flex-col gap-1">
            {history.map((item) => (
              <li key={item.slug}>
                <MediaRow item={item} thumbClass="w-44" />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
