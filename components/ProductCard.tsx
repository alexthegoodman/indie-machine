import Link from "next/link";
import type { Listing } from "@/lib/listing";
import { categoryLabel, platformLabel, PRICING } from "@/lib/taxonomy";
import { ScoreBadge, ScoreMeter } from "./ScoreMeter";

export function ProductCard({
  item,
  figNumber,
}: {
  item: Listing;
  figNumber?: number;
}) {
  const product = item.product;
  const name = product?.name ?? item.title;

  return (
    <Link
      href={`/posts/${item.slug}`}
      className="group relative flex h-full flex-col border border-line/28 transition-colors hover:border-accent/60"
    >
      {item.image && (
        <div className="aspect-[16/9] overflow-hidden border-b border-line/22 bg-panel/40">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={item.image}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover object-top transition-transform duration-300 group-hover:scale-[1.03]"
          />
        </div>
      )}
      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-[10px] tracking-[0.12em]">
              {figNumber !== undefined && (
                <span className="text-accent">
                  FIG. {String(figNumber).padStart(2, "0")}
                </span>
              )}
              {product && (
                <span className="text-ink-500">
                  {categoryLabel(product.category).toUpperCase()}
                </span>
              )}
              {item.sponsored && (
                <span className="border border-accent/60 px-1.5 py-0.5 text-accent">
                  SPONSORED
                </span>
              )}
            </div>
            <h3 className="mt-2 font-display text-xl font-bold text-ink-100 group-hover:text-accent">
              {name}
            </h3>
          </div>
          {item.score !== undefined && <ScoreBadge value={item.score} />}
        </div>

        <p className="mt-3 font-display text-[15px] leading-relaxed text-ink-300">
          {product?.tagline ?? item.excerpt}
        </p>

        {item.score !== undefined && (
          <ScoreMeter value={item.score} className="mt-4" />
        )}

        {product && product.tags.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {product.tags.slice(0, 4).map((tag) => (
              <span
                key={tag}
                className="border border-line/22 px-1.5 py-0.5 text-[10px] tracking-[0.06em] text-ink-400"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}

        <div className="min-h-5 flex-1" />
        <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2 border-t border-dashed border-line/22 pt-4 text-[11px] text-ink-500">
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {product?.pricing && (
              <span className="text-ink-300">{PRICING[product.pricing]}</span>
            )}
            {product?.license && <span>{product.license}</span>}
            {product && product.platforms.length > 0 && (
              <span>
                {product.platforms.slice(0, 3).map(platformLabel).join(" / ")}
              </span>
            )}
          </div>
          <span className="flex items-center gap-3">
            <time dateTime={item.date}>{item.date}</time>
            <span className="text-accent">REVIEW →</span>
          </span>
        </div>
      </div>
    </Link>
  );
}
