"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { useReportWebVitals } from "next/web-vitals";
import { flush, pageview, startAnalytics, track } from "@/lib/analytics/client";

const VITALS = new Set(["LCP", "CLS", "INP", "FCP", "TTFB"]);
/** Metric ids already sent. web-vitals gives each metric a new id per page load (or bfcache restore). */
const sentVitals = new Set<string>();

// Module-level so its identity never changes: useReportWebVitals re-registers every observer
// (without removing the old ones) whenever the callback it gets is a new function.
function reportVital(m: { id: string; name: string; value: number; rating?: string }) {
  if (!VITALS.has(m.name) || sentVitals.has(m.id)) return;
  sentVitals.add(m.id);
  track("web_vital", { metric: m.name, value: m.name === "CLS" ? Math.round(m.value * 1000) / 1000 : Math.round(m.value), rating: m.rating });
  // CLS and INP arrive as the page is hidden, after the regular hide flush has run.
  if (document.visibilityState === "hidden") flush(true);
}

// First-party event logging: a page view per route, plus the global listeners in
// lib/analytics/client.ts (engaged time, clicks, errors). Renders nothing.
export function AnalyticsTracker() {
  const pathname = usePathname();

  useEffect(() => {
    startAnalytics();
  }, []);

  useEffect(() => {
    pageview(pathname);
  }, [pathname]);

  useReportWebVitals(reportVital);

  return null;
}
