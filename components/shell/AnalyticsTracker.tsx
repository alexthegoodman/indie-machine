"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { useReportWebVitals } from "next/web-vitals";
import { pageview, startAnalytics, track } from "@/lib/analytics/client";

const VITALS = new Set(["LCP", "CLS", "INP", "FCP", "TTFB"]);

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

  useReportWebVitals((m) => {
    if (!VITALS.has(m.name)) return;
    track("web_vital", { metric: m.name, value: m.name === "CLS" ? Math.round(m.value * 1000) / 1000 : Math.round(m.value), rating: m.rating });
  });

  return null;
}
