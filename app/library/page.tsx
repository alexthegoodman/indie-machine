import type { Metadata } from "next";
import { PageBody } from "@/components/media/ChannelHeader";
import { LibraryView } from "@/components/media/LibraryView";

export const metadata: Metadata = {
  title: "Saved & History | Indie Machine",
  description: "Posts you saved for later and your reading history on Indie Machine, kept in this browser.",
  alternates: { canonical: "/library" },
  robots: { index: false, follow: true },
};

export default function LibraryPage() {
  return (
    <PageBody>
      <div className="text-[11px] tracking-[0.14em] text-accent">
        // YOUR LIBRARY <span className="text-ink-500">STORED IN THIS BROWSER ONLY</span>
      </div>
      <h1 className="mt-2 font-display text-4xl font-bold text-ink-100">Saved &amp; History</h1>
      <LibraryView />
    </PageBody>
  );
}
