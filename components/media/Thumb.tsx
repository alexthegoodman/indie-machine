import type { MediaItem } from "@/lib/media";

// 16:9 cover for a post. Posts without an image get a blueprint-grid card
// with their series and title so every tile still reads as a thumbnail.
export function Thumb({
  item,
  progress,
  size = "md",
  className = "",
  children,
}: {
  item: Pick<MediaItem, "image" | "title" | "series" | "kind">;
  progress?: number;
  size?: "sm" | "md" | "lg";
  className?: string;
  children?: React.ReactNode;
}) {
  const label = (item.kind === "product" ? "Product Review" : item.series ?? "Dev Log").toUpperCase();
  return (
    <div className={`relative aspect-video overflow-hidden border border-line/22 bg-panel ${className}`}>
      {item.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.image}
          alt=""
          loading="lazy"
          className="h-full w-full object-cover object-top transition-transform duration-300 group-hover:scale-[1.04]"
        />
      ) : size === "sm" ? (
        <div className="thumb-grid flex h-full items-center justify-center p-1 text-center font-display text-[11px] font-bold text-accent">
          {label}
        </div>
      ) : (
        <div className="thumb-grid flex h-full flex-col justify-between p-4 text-left">
          <span className="text-[10px] tracking-[0.16em] text-accent">// {label}</span>
          <span
            className={`line-clamp-3 font-display leading-tight font-bold text-ink-100 ${
              size === "lg" ? "text-2xl md:text-4xl" : "text-lg"
            }`}
          >
            {item.title}
          </span>
        </div>
      )}
      {children}
      {progress !== undefined && progress > 0 && (
        <span className="absolute inset-x-0 bottom-0 h-[3px] bg-ink/70">
          <span className="block h-full bg-accent" style={{ width: `${progress}%` }} />
        </span>
      )}
    </div>
  );
}
