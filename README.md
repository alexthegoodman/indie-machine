# Indie Machine

Rust. Native. Complex applications. Indie Machine is a build-log blog for
Entropy, a native engine written from scratch in Rust — its own GPU compute
pipelines, its own immediate-mode GUI kit, its own docking system. Enjoy.

Built with Next.js (App Router) and MDX. No CMS — every post is
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

### Product reviews

Posts are split into three areas: **products** (`/products`), **game
announcements** (`/announcements`) and **dev posts** (`/dev`). A post's area
comes from `kind: product`, `kind: game` or `kind: dev`; without it, the
`Product Hunt` series (or any post with a `product` block) counts as a
product, the `Game Announcements` series as a game, and everything else as
dev. Game announcements list their impression badges in a `badges:` array. URLs stay `/posts/<slug>` either way.

Product reviews add a `product` block, which drives the product cards,
search and filters, the spec panel at the top of the review and "similar
products":

```yaml
product:
  name: "RexaDB"
  url: "https://www.rexadb.app"
  tagline: "Desktop studio for 100+ databases with RBAC and agent-safe MCP access."
  category: "data"              # a key from lib/taxonomy.ts
  tags: [database, sql, mcp, rust]
  license: "GPL-3.0"
  pricing: "free"               # free | freemium | paid
  platforms: [macos, windows, linux]   # see PLATFORMS in lib/taxonomy.ts
scores:                         # optional 1-10 scorecard; any keys work
  usability: 7
  security: 6
related: [some-other-slug]      # optional: pin these as similar products
sponsored: true                 # optional: shows a sponsored disclosure
```

Similar products rank by shared tags plus a bonus for the same category, so
reuse existing tags where they fit. To add a category, add it to
`CATEGORIES` in `lib/taxonomy.ts`.

Below the frontmatter, write normal Markdown/MDX: headings, fenced code
blocks (syntax-highlighted via `rehype-pretty-code`/Shiki), tables
(`remark-gfm`), and images.

**Images**: reference them with a path relative to `public/`, e.g.
`![alt text](images/my-screenshot.png)` for a file at
`public/images/my-screenshot.png`. Always write real alt text — it's
rendered as the visible caption under the image.

Card blurbs come from the product `tagline`, else the post's first
paragraph, and read times are computed from the body - there's no separate
excerpt or duration field to keep in sync. The cover image (frontmatter
`image`, else the first image in the body) is the card thumbnail and the
reader's stage; the reader drops that same image from the opening paragraphs
so it doesn't show twice.

## Site structure

The site is an app shell (`components/shell/`): a sticky top bar with a
search palette (Ctrl+K or `/`), a sidebar (collapsible on desktop, a drawer
on phones), a toast and a "continue reading" dock. Saved posts, history and
reading progress live in the browser's localStorage only (`lib/library.ts`).

| Route | What it is |
|---|---|
| `/` | Home - featured carousel, continue reading, filterable feed, leaderboard, game shelf |
| `/posts/[slug]` | Reader - cover stage, actions, scorecard, chapters from the h2s, up-next queue with auto-advance |
| `/products`, `/dev`, `/announcements` | Channel pages with search and filters |
| `/series`, `/series/[series]` | Series list and one series |
| `/archive` | Every post, newest first |
| `/library` | Saved posts and reading history (this browser, not indexed) |
| `/games`, `/free-ai`, `/promote`, `/about` | Landing pages |
| `/rss.xml` | RSS feed, generated from the same post data |
| `/llms.txt` | Plain-text guide to the site, series, and articles for AI readers |

The canonical origin defaults to `https://indie-machine.com`. Set
`NEXT_PUBLIC_SITE_URL` only when a different canonical origin is intentional.
This origin is used by canonical URLs, the sitemap, RSS feed, article
structured data, and `llms.txt`.

`lib/posts.ts` is the single source of truth for reading and sorting posts —
new routes should pull from there rather than reading `app/posts/` directly.

## Design system

Dark "blueprint" look: near-black ground, grid background, cyan accent, amber
for game badges, Space Grotesk over IBM Plex Mono, square corners and dashed
rules. Tokens are in `app/globals.css`; the media components (cards, shelves,
channel headers, carousel) are in `components/media/` and the reader pieces
in `components/reader/`.

## Tests

`tests/media-center.feature` describes the app shell's behaviour, and
`tests/media-center.test.mjs` runs it against a production build in the
installed Chrome through `playwright-core`, which isn't a dependency here -
point `PLAYWRIGHT_CORE` at any install:

```bash
npx next build && npx next start -p 3123
BASE_URL=http://localhost:3123 PLAYWRIGHT_CORE=/path/to/node_modules/playwright-core   SCREENSHOT_DIR=/tmp/im-shots node tests/media-center.test.mjs
```

`tests/visitor-launches.feature` / `.test.mjs` run the same way. They need
network access (they launch example.com and a GitHub repo) and the local
database from `.env`, and they delete their own rows before and after.

## Scripts

```bash
npm run dev      # local dev server
npm run build    # production build (also type-checks and statically
                  # generates every post/series page)
npm run start    # serve the production build
```

## Allegiance API

`/api/allegiance/*` is the server for Allegiance, the MMO at
allegiance.indie-machine.com: anonymous sessions and accounts, nations and their
saves, the territory map between players, world news, and signed tickets for
the realtime server (allegiance-realtime, Cloudflare Durable Objects). Code in
`app/api/allegiance/` and `lib/allegiance/`; schema in `prisma/schema.prisma`
(Prisma 7.10.0, PostgreSQL through `@prisma/adapter-pg`).

| Route | Does |
| --- | --- |
| `POST session` | New anonymous player, or resume with `Authorization: Bearer` |
| `POST account` / `POST login` | Claim an email + password / sign in on a device |
| `GET` / `POST nation` | Your nation and save / found a new one (dissolves the old) |
| `PUT save` | Store the campaign JSON |
| `GET territories?since=` | Territory rows changed since a time |
| `POST territories/claim` / `release` / `report` | Take (contests other nations), lose to a regime, daily troop report |
| `GET events?after=` | World news |
| `POST ticket` | Signed realtime join ticket |

Local development:

```bash
npm run db:dev             # local Prisma Postgres (prints its postgres:// URL)
npx prisma migrate deploy  # with DATABASE_URL in .env
npm run dev
```

Environment (`.env` locally, Vercel project settings in production):
`DATABASE_URL` (a pooled URL on Vercel), `ALLEGIANCE_REALTIME_SECRET` (shared
with allegiance-realtime), `ALLEGIANCE_REALTIME_URL` (its `wss://` URL),
`ALLEGIANCE_ORIGINS` (comma-separated game origins; defaults to
`https://allegiance.indie-machine.com`). Run `npm run db:migrate` against
production after schema changes.

## Visitor Launches

The strip under the top bar on every page (`components/shell/LaunchBar.tsx`).
Anyone can launch a product by pasting its URL, no account. `POST
/api/launches` fetches the page and fills the listing from its `og:` /
`<title>` / description / icon tags, and the listing is live when the request
returns (usually well under a second; the fetch gives up after 8s). Visitors
can fold the strip to one line; that choice is kept in localStorage.

Checks, in `lib/launches/`: one listing per product (key is the bare host, or
host + path on shared hosts like GitHub, Steam, app stores - see
`SHARED_HOSTS` in `url.ts`), also checked after redirects; 3 launches per IP
per day and 120 per hour site-wide; no IPs, local names, custom ports or link
shorteners; the fetch refuses private, loopback and link-local addresses at
connect time and on every redirect; the page must be HTML with a title; a
small spam-word list; a honeypot field; POSTs from other origins get 403.
Links are `rel="nofollow ugc"`.

| Route | Does |
| --- | --- |
| `GET /api/launches` | Latest 40 visible launches (CDN cache 10s) |
| `POST /api/launches` `{ url }` | Launch a product |
| `DELETE /api/launches?id=` | Hide one (`Authorization: Bearer $LAUNCHES_ADMIN_TOKEN`); its key stays taken |

Env: `LAUNCHES_ADMIN_TOKEN` (takedowns; unset means DELETE always 401s),
`LAUNCHES_SALT` (salts the stored IP hashes; set it in production).

## Analytics

First-party event logging, no third-party script. Every page reports to
`POST /api/events` (`lib/analytics/client.ts`, mounted by
`components/shell/AnalyticsTracker.tsx`); events land in `analytics_events`
(Prisma model `AnalyticsEvent`). Visitors are anonymous: a random visitor id
in localStorage, a session id in sessionStorage (new after 30 idle minutes),
no cookies, no IPs. Country and city come from Vercel's edge headers. Bots
(by user agent) are dropped, and automated browsers send nothing unless
`localStorage.im_analytics_test = "1"`.

Recorded automatically: `pageview`, `engage` (visible, in-use time and scroll
depth per page), `read_depth` (25/50/75/100 of a post body), `link_click`,
`outbound_click`, `search`, `search_select`, `save`, `share`,
`launch_submit`, `ad_click`, `web_vital`, `js_error` (full list with props in
`lib/analytics/events.ts`). To add one: `track("name", { ...props })` from a
client component, or put `data-track="name"` and `data-track-<prop>="..."`
on any clickable element.

`/insights` is the dashboard, behind `ANALYTICS_PASSWORD`: Overview,
Content (engagement, read-through, searches, web vitals, script errors),
Journeys (page before/after, common paths), Funnels, Retention (weekly
cohorts), Breakdown (any dimension or event property, or two against each
other), Sessions (with per-session timelines and per-visitor history) and a
raw Events explorer with CSV export. The URL is the whole state:
`f=dim:value` filters (`f=!dim:value` excludes, `*` is a wildcard),
`did=` / `didnt=` keep sessions that did or never did a step (`p:/posts/*`,
`e:outbound_click`, `e:outbound_click:host=github.com`). Signing in also
excludes that browser from the data (toggle in the header).

Env: `ANALYTICS_PASSWORD` (unset means the dashboard stays locked),
`ANALYTICS_TIMEZONE` (default zone for day/hour buckets, e.g.
`America/New_York`; default UTC), `ANALYTICS_DB_CONCURRENCY` (how many report
queries run at once; default 4 in production, 1 in development, since the
local `prisma dev` server drops connections under parallel load).

Tests: `tests/analytics.feature` / `tests/analytics.test.mjs` (run against
`next start` with `ANALYTICS_PASSWORD` set; usage at the top of the file).
