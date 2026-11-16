"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MediaItem } from "@/lib/media";
import { setPreference, useLibrary } from "@/lib/library";
import { ShellContext, type ShellApi } from "./ShellContext";
import { SearchPalette } from "./SearchPalette";
import { ContinueDock } from "./ContinueDock";
import { LaunchBar } from "./LaunchBar";
import {
  BookmarkIcon,
  DiamondIcon,
  GamepadIcon,
  HomeIcon,
  MenuIcon,
  ReviewIcon,
  RssIcon,
  SearchIcon,
  SparkIcon,
  TerminalIcon,
} from "./icons";

const PRIMARY = [
  { href: "/", label: "Home", short: "Home", Icon: HomeIcon },
  { href: "/products", label: "Product Reviews", short: "Reviews", Icon: ReviewIcon },
  { href: "/dev", label: "Dev Log", short: "Dev Log", Icon: TerminalIcon },
  { href: "/announcements", label: "Game Announcements", short: "Games", Icon: DiamondIcon },
  { href: "/games", label: "Play Games", short: "Play", Icon: GamepadIcon },
  { href: "/free-ai", label: "Free AI", short: "Free AI", Icon: SparkIcon },
] as const;

const SECONDARY = [
  { href: "/about", label: "About" },
  { href: "/promote", label: "Advertise" },
  { href: "/archive", label: "Archive" },
  { href: "/series", label: "All series" },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function Rail({
  pathname,
  compact,
  series,
  savedCount,
}: {
  pathname: string;
  compact: boolean;
  series: string[];
  savedCount: number;
}) {
  const item = (active: boolean) =>
    compact
      ? `flex flex-col items-center gap-1.5 px-1 py-3.5 text-[10px] tracking-[0.02em] ${
          active ? "text-accent" : "text-ink-400 hover:bg-line/6 hover:text-ink-100"
        }`
      : `flex min-h-11 items-center gap-3.5 border-l-2 px-3.5 text-[13px] ${
          active
            ? "border-accent bg-accent/10 text-accent"
            : "border-transparent text-ink-400 hover:bg-line/6 hover:text-ink-100"
        }`;

  return (
    <nav aria-label="Main navigation" className="flex flex-col gap-0.5 py-3">
      {PRIMARY.map(({ href, label, short, Icon }) => {
        const active = isActive(pathname, href);
        return (
          <Link key={href} href={href} className={item(active)} aria-current={active ? "page" : undefined}>
            <Icon />
            <span className={compact ? "text-center" : ""}>{compact ? short : label}</span>
          </Link>
        );
      })}

      <div className={compact ? "my-2 mx-3 h-px bg-line/14" : "my-3 mx-2 h-px bg-line/14"} />
      {!compact && <div className="px-3.5 pb-1.5 text-[10px] tracking-[0.16em] text-ink-500">YOUR LIBRARY</div>}
      <Link
        href="/library"
        className={item(isActive(pathname, "/library"))}
        aria-current={isActive(pathname, "/library") ? "page" : undefined}
      >
        <BookmarkIcon />
        {compact ? (
          <span>Library</span>
        ) : (
          <>
            <span className="flex-1">Saved &amp; History</span>
            {savedCount > 0 && <span className="text-[11px] text-accent">{savedCount}</span>}
          </>
        )}
      </Link>

      {!compact && series.length > 0 && (
        <>
          <div className="my-3 mx-2 h-px bg-line/14" />
          <div className="px-3.5 pb-1.5 text-[10px] tracking-[0.16em] text-ink-500">SERIES</div>
          {series.map((name) => {
            const href = `/series/${encodeURIComponent(name)}`;
            const active = isActive(pathname, href);
            return (
              <Link key={name} href={href} className={item(active)} aria-current={active ? "page" : undefined}>
                <span className="flex h-5 w-5 items-center justify-center border border-accent/40 font-display text-[11px] font-bold text-accent">
                  {name[0]}
                </span>
                <span className="truncate">{name}</span>
              </Link>
            );
          })}
        </>
      )}

      {!compact && (
        <>
          <div className="my-3 mx-2 h-px bg-line/14" />
          <div className="flex flex-wrap gap-x-4 gap-y-2 px-3.5 text-[11px]">
            {SECONDARY.map((l) => (
              <Link key={l.href} href={l.href} className="text-ink-500! hover:text-ink-100!">
                {l.label}
              </Link>
            ))}
            <a href="/rss.xml" className="text-ink-500! hover:text-ink-100!">
              RSS
            </a>
          </div>
          <div className="mt-4 px-3.5 text-[10px] leading-relaxed tracking-[0.04em] text-ink-500">
            TOOLS REVIEWED FROM SOURCE.
            <br />© 2026 INDIE MACHINE
          </div>
        </>
      )}
    </nav>
  );
}

export function AppShell({
  items,
  footer,
  children,
}: {
  items: MediaItem[];
  footer: React.ReactNode;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const library = useLibrary();
  const compact = !!library.railCompact;
  const [drawer, setDrawer] = useState(false);
  const [search, setSearch] = useState(false);
  const [toastMsg, setToastMsg] = useState("");
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const bySlug = useMemo(() => new Map(items.map((i) => [i.slug, i])), [items]);
  const series = useMemo(() => {
    const counts = new Map<string, number>();
    for (const i of items) if (i.kind === "dev" && i.series) counts.set(i.series, (counts.get(i.series) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([name]) => name);
  }, [items]);

  const toast = useCallback((message: string) => {
    clearTimeout(toastTimer.current);
    setToastMsg(message);
    toastTimer.current = setTimeout(() => setToastMsg(""), 2200);
  }, []);
  const openSearch = useCallback(() => setSearch(true), []);
  const api = useMemo<ShellApi>(() => ({ items, bySlug, toast, openSearch }), [items, bySlug, toast, openSearch]);

  // Close the mobile drawer whenever the route changes.
  useEffect(() => setDrawer(false), [pathname]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing = !!target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setSearch(true);
      } else if (e.key === "/" && !typing) {
        e.preventDefault();
        setSearch(true);
      } else if (e.key === "Escape") {
        setDrawer(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const toggleMenu = () => {
    if (window.matchMedia("(min-width: 1024px)").matches) setPreference("railCompact", !compact);
    else setDrawer((d) => !d);
  };

  return (
    <ShellContext.Provider value={api}>
      <a
        href="#main"
        className="sr-only z-50 bg-accent px-4 py-2 font-semibold text-ink! focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Skip to content
      </a>

      <header className="sticky top-0 z-40 h-16 border-b border-dashed border-line/22 bg-ink/94 backdrop-blur-sm">
        <div className="flex h-full items-center gap-2 px-2 sm:gap-4 sm:px-4">
          <button
            type="button"
            onClick={toggleMenu}
            aria-label="Toggle navigation"
            aria-expanded={drawer}
            className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center text-ink-300 hover:bg-accent/10 hover:text-ink-100"
          >
            <MenuIcon />
          </button>
          <Link href="/" className="flex shrink-0 items-center gap-2.5 py-2 text-ink-100!">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icon.png" alt="" className="w-4" />
            <span className="text-[13px] font-medium tracking-[0.12em]">INDIE&nbsp;/&nbsp;MACHINE</span>
          </Link>

          <div className="flex min-w-0 flex-1 justify-center px-2">
            <button
              type="button"
              onClick={openSearch}
              className="hidden h-11 w-full max-w-[520px] cursor-pointer items-center gap-3 border border-line/28 bg-ink px-3.5 text-left text-ink-500 hover:border-accent/60 md:flex"
            >
              <SearchIcon size={16} />
              <span className="flex-1 truncate font-display text-[15px]">Search reviews, dev posts, games...</span>
              <kbd className="border border-line/22 px-1.5 py-0.5 font-mono text-[10px] tracking-[0.08em] text-ink-400">
                CTRL K
              </kbd>
            </button>
          </div>

          <button
            type="button"
            onClick={openSearch}
            aria-label="Search"
            className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center text-ink-300 hover:bg-accent/10 md:hidden"
          >
            <SearchIcon />
          </button>
          <a
            href="/rss.xml"
            aria-label="RSS feed"
            className="hidden h-11 w-11 shrink-0 items-center justify-center text-ink-300! hover:bg-accent/10 sm:flex"
          >
            <RssIcon size={18} />
          </a>
          <Link
            href="/promote"
            className="hidden shrink-0 border border-accent/50 px-3.5 py-3 text-[11px] tracking-[0.14em] hover:bg-accent/10 sm:block"
          >
            ADVERTISE
          </Link>
        </div>
      </header>

      <div className="relative z-10 flex">
        <aside
          className={`sticky top-16 hidden h-[calc(100dvh-4rem)] shrink-0 overflow-y-auto border-r border-dashed border-line/18 [scrollbar-width:thin] lg:block ${
            compact ? "w-[76px]" : "w-60"
          }`}
        >
          <Rail pathname={pathname} compact={compact} series={series} savedCount={library.saved.length} />
        </aside>

        <main id="main" className="min-w-0 flex-1">
          <LaunchBar />
          {children}
          {footer}
        </main>
      </div>

      {drawer && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            onClick={() => setDrawer(false)}
            className="absolute inset-0 cursor-default bg-black/60"
          />
          <div className="absolute inset-y-0 left-0 w-72 max-w-[85vw] overflow-y-auto border-r border-line/22 bg-ink">
            <div className="flex h-16 items-center gap-3 border-b border-dashed border-line/22 px-4">
              <button
                type="button"
                onClick={() => setDrawer(false)}
                aria-label="Close navigation"
                className="flex h-11 w-11 cursor-pointer items-center justify-center text-ink-300"
              >
                <MenuIcon />
              </button>
              <span className="text-[13px] font-medium tracking-[0.12em] text-ink-100">INDIE&nbsp;/&nbsp;MACHINE</span>
            </div>
            <Rail pathname={pathname} compact={false} series={series} savedCount={library.saved.length} />
          </div>
        </div>
      )}

      {search && <SearchPalette onClose={() => setSearch(false)} />}

      <div className="pointer-events-none fixed right-4 bottom-4 left-4 z-40 flex flex-col items-end gap-3 sm:left-auto">
        {toastMsg && (
          <div role="status" className="pointer-events-auto bg-ink-100 px-4 py-3 text-[13px] font-medium text-ink">
            {toastMsg}
          </div>
        )}
        <ContinueDock pathname={pathname} />
      </div>
    </ShellContext.Provider>
  );
}
