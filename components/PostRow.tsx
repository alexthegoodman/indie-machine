import Link from "next/link";
import type { Post } from "@/lib/posts";
import { iconForSlug } from "./icons";
import { specChips } from "./specChips";

export function PostRow({
  post,
  figNumber,
  border = "top",
}: {
  post: Post;
  figNumber: number;
  border?: "top" | "both" | "none";
}) {
  const Icon = iconForSlug(post.slug);
  const borderClass =
    border === "both"
      ? "border-y"
      : border === "top"
        ? "border-t"
        : "";

  return (
    <Link
      href={`/posts/${post.slug}`}
      className={`group flex flex-col gap-4 py-8 sm:flex-row sm:items-start sm:gap-8 ${borderClass} border-dashed border-line/22`}
    >
      <div className="flex items-center gap-4 sm:contents">
        <div className="w-12 shrink-0 font-display text-[28px] font-semibold text-accent">
          {String(figNumber).padStart(2, "0")}
        </div>
        <Icon className="w-10 shrink-0 text-line/70" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="font-display text-xl font-semibold text-ink-100 group-hover:text-accent">
          {post.title}
        </div>
        {post.excerpt && (
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-ink-400">{post.excerpt}</p>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          {specChips(post).map((chip) => (
            <span
              key={chip}
              className="border border-line/25 px-1.5 py-0.5 text-[10px] tracking-[0.06em] text-ink-400"
            >
              {chip}
            </span>
          ))}
        </div>
      </div>

      <div className="shrink-0 text-left sm:w-36 sm:text-right">
        <div className="text-[11px] text-ink-500">{(post.series ?? "UNCATEGORIZED").toUpperCase()} SERIES</div>
        <div className="mt-1 text-[11px] text-ink-500">{post.date}</div>
        <div className="mt-2 text-xs text-accent">READ →</div>
      </div>
    </Link>
  );
}
