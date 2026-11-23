import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { dashboardPassword, isSignedIn } from "@/lib/analytics/auth";
import { Links, type Params } from "@/lib/analytics/links";
import { all, isDim, one, parseQuery, parseStep } from "@/lib/analytics/query";
import { breakdown } from "@/lib/analytics/reports";
import { FilterBar } from "@/components/insights/FilterBar";
import { ThisBrowser } from "@/components/insights/ThisBrowser";
import { signIn, signOut } from "./actions";
import { Overview } from "./_views/Overview";
import { Content } from "./_views/Content";
import { Journeys } from "./_views/Journeys";
import { Funnels } from "./_views/Funnels";
import { Retention } from "./_views/Retention";
import { Breakdown } from "./_views/Breakdown";
import { Sessions, SessionDetail, VisitorDetail } from "./_views/Sessions";
import { Events } from "./_views/Events";
import { Survey } from "./_views/Survey";
import type { ViewProps } from "./_views/types";

export const metadata: Metadata = {
  title: "Insights - Indie Machine",
  robots: { index: false, follow: false },
};

const TABS = [
  ["overview", "Overview", Overview],
  ["content", "Content", Content],
  ["journeys", "Journeys", Journeys],
  ["funnels", "Funnels", Funnels],
  ["retention", "Retention", Retention],
  ["breakdown", "Breakdown", Breakdown],
  ["sessions", "Sessions", Sessions],
  ["events", "Events", Events],
  ["survey", "Survey", Survey],
] as const;

const DETAILS: Partial<Record<string, (p: ViewProps) => Promise<React.ReactNode>>> = {
  session: SessionDetail,
  visitor: VisitorDetail,
};

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="min-h-dvh bg-ink px-4 py-5 font-mono text-ink-300 sm:px-6">{children}</div>;
}

function Gate({ error, configured }: { error?: string; configured: boolean }) {
  return (
    <Shell>
      <div className="mx-auto mt-[14vh] max-w-sm border border-line/22 p-6">
        <div className="text-[13px] font-medium tracking-[0.12em] text-ink-100">INDIE / MACHINE · INSIGHTS</div>
        {configured ? (
          <form action={signIn} className="mt-5 space-y-3">
            <label htmlFor="ins-password" className="block text-[11px] tracking-[0.1em] text-ink-500">
              PASSWORD
            </label>
            <input
              id="ins-password"
              name="password"
              type="password"
              required
              autoFocus
              autoComplete="current-password"
              className="h-11 w-full border border-line/28 bg-ink px-3 text-ink-100 focus:border-accent focus:outline-none"
            />
            {error && (
              <p role="alert" className="text-[12px] text-badge">
                {error === "locked" ? "Too many attempts. Try again in 15 minutes." : "That's not the password."}
              </p>
            )}
            <button className="h-11 w-full cursor-pointer bg-accent text-[12px] font-semibold tracking-[0.12em] text-ink">SIGN IN</button>
          </form>
        ) : (
          <p className="mt-4 text-[12px] leading-relaxed">
            The dashboard is off until <code>ANALYTICS_PASSWORD</code> is set in the environment.
          </p>
        )}
      </div>
    </Shell>
  );
}

/** The add-filter and add-segment forms post plain fields; fold them into the URL model. */
function normalize(params: Params): string | null {
  const fdim = one(params, "fdim");
  const seg = one(params, "seg");
  if (fdim === undefined && seg === undefined) return null;
  const out = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (["fdim", "fval", "fneg", "seg", "segneg"].includes(k)) continue;
    for (const x of Array.isArray(v) ? v : v === undefined ? [] : [v]) out.append(k, x);
  }
  const fval = one(params, "fval")?.trim();
  if (fdim && isDim(fdim) && fval) out.append("f", `${one(params, "fneg") ? "!" : ""}${fdim}:${fval}`);
  if (seg && parseStep(seg)) out.append(one(params, "segneg") ? "didnt" : "did", seg.trim());
  out.delete("page");
  out.delete("before");
  return `/insights?${out}`;
}

export default async function InsightsPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  if (!dashboardPassword()) return <Gate configured={false} />;
  if (!(await isSignedIn())) return <Gate configured error={one(params, "error")} />;
  const target = normalize(params);
  if (target) redirect(target);

  const q = parseQuery(params);
  const links = new Links(params);
  const view = one(params, "view") ?? "overview";
  const tab = TABS.find(([k]) => k === view);
  const Detail = DETAILS[view];
  const View = tab?.[2] ?? Overview;

  const [pages, events] = await Promise.all([breakdown(q, "path", { name: "pageview", limit: 40 }), breakdown(q, "name", { limit: 30 })]);
  const props: ViewProps = { q, links, params };
  const active = Detail ? "sessions" : (tab?.[0] ?? "overview");

  return (
    <Shell>
      <header className="mb-4 flex flex-wrap items-center gap-x-6 gap-y-3">
        <Link href="/insights" className="flex items-center gap-2.5 text-ink-100!">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon.png" alt="" className="w-4" />
          <span className="text-[13px] font-medium tracking-[0.12em]">INSIGHTS</span>
        </Link>
        <nav aria-label="Views" className="flex flex-wrap gap-1">
          {TABS.map(([k, label]) => (
            <Link
              key={k}
              href={links.view(k)}
              aria-current={k === active ? "page" : undefined}
              className={`px-3 py-2 text-[12px] ${k === active ? "bg-accent/14 text-accent!" : "text-ink-400! hover:text-ink-100!"}`}
            >
              {label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-5 text-[11px]">
          <ThisBrowser />
          <Link href="/" className="text-ink-400! hover:text-accent!">
            SITE
          </Link>
          <form action={signOut}>
            <button className="cursor-pointer text-ink-400 hover:text-accent">SIGN OUT</button>
          </form>
        </div>
      </header>

      <FilterBar q={q} links={links} params={params} suggestions={{ pages: pages.map((p) => p.key!).filter(Boolean), events: events.map((e) => e.key!).filter(Boolean) }} />

      <main className="mt-4">
        {Detail ? (
          <div className="space-y-3">
            <Link href={links.view("sessions")} className="text-[11px]">
              &lt;- ALL SESSIONS
            </Link>
            {await Detail(props)}
          </div>
        ) : (
          <View {...props} />
        )}
      </main>
      {all(params, "f").length + all(params, "did").length + all(params, "didnt").length === 0 && view === "overview" && (
        <p className="mt-6 text-[11px] text-ink-500">
          Tip: click any value to filter everything by it; use <em>did</em> on a row to keep only sessions that did it, then look at their sources, pages and paths.
        </p>
      )}
    </Shell>
  );
}
