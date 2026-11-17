"use client";

import { toggleSaved, useLibrary } from "@/lib/library";
import { useShell } from "@/components/shell/ShellContext";
import { BookmarkIcon, ShareIcon } from "@/components/shell/icons";
import { track } from "@/lib/analytics/client";

const BUTTON =
  "inline-flex h-11 cursor-pointer items-center gap-2 border border-line/28 px-3.5 text-xs tracking-[0.08em] hover:border-accent hover:bg-accent/10";

export function ReaderActions({ slug, title }: { slug: string; title: string }) {
  const { toast } = useShell();
  const saved = useLibrary().saved.includes(slug);

  const share = async () => {
    const url = window.location.href.split("#")[0];
    if (navigator.share && window.matchMedia("(hover: none)").matches) {
      try {
        await navigator.share({ title, url });
        track("share", { slug, method: "native" });
        return;
      } catch {
        // Cancelled or unsupported: fall through to copying.
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      toast("Link copied");
      track("share", { slug, method: "copy" });
    } catch {
      toast("Could not copy the link");
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => {
          const nowSaved = toggleSaved(slug);
          track("save", { slug, saved: nowSaved });
          toast(nowSaved ? "Saved to your library" : "Removed from Saved");
        }}
        aria-pressed={saved}
        className={`${BUTTON} ${saved ? "text-accent" : "text-ink-100"}`}
      >
        <BookmarkIcon size={16} filled={saved} />
        {saved ? "SAVED" : "SAVE"}
      </button>
      <button type="button" onClick={share} className={`${BUTTON} text-ink-100`}>
        <ShareIcon size={16} />
        SHARE
      </button>
    </>
  );
}
