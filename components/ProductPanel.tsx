import Link from "next/link";
import type { ProductInfo } from "@/lib/posts";
import { categoryLabel, platformLabel, PRICING, scoreLabel } from "@/lib/taxonomy";
import { ScoreMeter } from "./ScoreMeter";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[96px_minmax(0,1fr)] gap-3 border-t border-dashed border-line/22 py-2.5 first:border-t-0">
      <div className="text-[10px] tracking-[0.12em] text-ink-500">{label}</div>
      <div className="text-[13px] text-ink-100">{children}</div>
    </div>
  );
}

// The "product spec" block at the top of a review: what it is, what it
// costs, where it runs, and the scorecard if the review has one.
export function ProductPanel({
  product,
  scores,
  score,
}: {
  product: ProductInfo;
  scores?: Record<string, number>;
  score?: number;
}) {
  return (
    <div className="grid max-w-4xl border border-line/28 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="p-5">
        <div className="text-[10px] tracking-[0.12em] text-accent">PRODUCT SPEC</div>
        <div className="mt-1.5 font-display text-2xl font-bold text-ink-100">{product.name}</div>
        {product.tagline && <p className="mt-1.5 font-display text-[15px] leading-relaxed text-ink-300">{product.tagline}</p>}
        <div className="mt-4">
          <Row label="CATEGORY">
            <Link href={`/products?category=${product.category}`} className="text-ink-100 hover:text-accent">
              {categoryLabel(product.category)}
            </Link>
          </Row>
          {product.pricing && <Row label="PRICING">{PRICING[product.pricing]}</Row>}
          {product.license && <Row label="LICENSE">{product.license}</Row>}
          {product.platforms.length > 0 && <Row label="PLATFORMS">{product.platforms.map(platformLabel).join(" / ")}</Row>}
          {product.tags.length > 0 && (
            <Row label="TAGS">
              <span className="flex flex-wrap gap-x-2 gap-y-1">
                {product.tags.map((tag) => (
                  <Link key={tag} href={`/products?tag=${encodeURIComponent(tag)}`} className="text-[12px] text-ink-400 hover:text-accent">
                    #{tag}
                  </Link>
                ))}
              </span>
            </Row>
          )}
        </div>
        {product.url && (
          <a
            href={product.url}
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-flex border border-line/28 px-3 py-2 text-[11px] tracking-[0.1em] text-ink-300 hover:border-accent/60 hover:text-accent"
          >
            VISIT PRODUCT ↗
          </a>
        )}
      </div>

      <div className="border-t border-line/28 p-5 md:border-t-0 md:border-l">
        {scores && score !== undefined ? (
          <>
            <div className="flex items-baseline justify-between">
              <div className="text-[10px] tracking-[0.12em] text-accent">SCORECARD</div>
              <div className="font-display text-3xl font-bold text-ink-100">
                {score.toFixed(1)}
                <span className="ml-1 text-sm font-normal text-ink-500">/ 10</span>
              </div>
            </div>
            <div className="mt-4 space-y-3">
              {Object.entries(scores).map(([key, value]) => (
                <div key={key}>
                  <div className="flex justify-between text-[11px]">
                    <span className="tracking-[0.08em] text-ink-400">{scoreLabel(key).toUpperCase()}</span>
                    <span className="text-ink-100">{value}</span>
                  </div>
                  <ScoreMeter value={value} className="mt-1.5" />
                </div>
              ))}
            </div>
            <p className="mt-4 text-[11px] leading-relaxed text-ink-500">
              1-10 per concern. Below 3 is nonexistent, 8 and above is world-class. Rationale is in the review.
            </p>
          </>
        ) : (
          <div className="flex h-full flex-col justify-center text-[11px] leading-relaxed text-ink-500">
            <div className="tracking-[0.12em] text-ink-400">NO SCORECARD</div>
            <p className="mt-2">
              This review predates the standard scorecard. The verdict is in the write-up.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
