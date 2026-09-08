# Indie Machine

Rust. Native. Complex applications. Indie Machine is a build-log blog for
Entropy, a native engine written from scratch in Rust — its own GPU compute
pipelines, its own immediate-mode GUI kit, its own docking system.

Built with Next.js (App Router) and MDX. No database, no CMS — every post is
a file in the repo.

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Writing a post

Posts live in `app/posts/` as `.mdx` files, named:

```
YYYY-MM-DD-a-url-safe-slug.mdx
```

The date prefix keeps posts sorted on disk; everything after it becomes the
post's URL slug (e.g. `2026-09-08-fft-ocean-water.mdx` → `/posts/fft-ocean-water`).
Posts with the same date keep filename order as their tiebreak, so within a
same-day batch, name them in the order you want them to read.

Each file starts with YAML frontmatter:

```yaml
---
title: "Post Title"
date: 2026-09-08
series: Entropy          # optional — groups posts under /series
repo_link: entropy-engine @ 2e23e6d   # optional — shown on the post page
crate_versions:           # optional — rendered as a "BUILD SPEC" table.
  unchanged:               # any shape works: the renderer just walks
    - wgpu = "27.0.1"      # whatever keys/arrays/strings you give it.
  edition: "2024"
  os: "Windows 11"
---
```

`crate_versions` has no fixed schema — `components/SpecSheet.tsx` renders
whatever keys and values (strings or arrays) you put there.

Below the frontmatter, write normal Markdown/MDX: headings, fenced code
blocks (syntax-highlighted via `rehype-pretty-code`/Shiki), tables
(`remark-gfm`), and images.

**Images**: reference them with a path relative to `public/`, e.g.
`![alt text](images/my-screenshot.png)` for a file at
`public/images/my-screenshot.png`. Always write real alt text — it's
rendered as the visible caption under the image.

The homepage's "full index" and the archive/series pages all pull their dek
text automatically from each post's first paragraph — there's no separate
excerpt field to keep in sync.

## Site structure

| Route | What it is |
|---|---|
| `/` | Homepage — masthead, featured post, series diagram, full index |
| `/posts/[slug]` | A single post |
| `/archive` | Every post, oldest to newest |
| `/series` | List of series |
| `/series/[series]` | Posts in one series |
| `/about` | What this blog is |
| `/rss.xml` | RSS feed, generated from the same post data |

`lib/posts.ts` is the single source of truth for reading and sorting posts —
new routes should pull from there rather than reading `app/posts/` directly.

## Design system

The site's look (deep-navy "blueprint" sheet, grid background, corner
registration marks, dimension-line dividers, title-block metadata tables) is
implemented directly in `app/globals.css` and the shared components under
`components/`. There's also a Claude Design canvas exploring this direction
in `design/Main.dc.html` if you want to prototype visual changes before
touching the real components.

## Scripts

```bash
npm run dev      # local dev server
npm run build    # production build (also type-checks and statically
                  # generates every post/series page)
npm run start    # serve the production build
```
