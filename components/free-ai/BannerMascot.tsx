"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

const YumonMascot = dynamic(() => import("@/components/mascot/YumonMascot").then((m) => m.YumonMascot), { ssr: false });

// Yumon waving from the home banner. Mounts only once the page has loaded and gone idle, so
// the mascot chunk, three.js and the 3.8 MB model never compete with the home page's own
// load. The parent hides it on narrow screens, and a hidden stage never fetches anything.
export function BannerMascot({ className = "" }: { className?: string }) {
  const [go, setGo] = useState(false);

  useEffect(() => {
    let idle = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const start = () => {
      if (typeof requestIdleCallback === "function") idle = requestIdleCallback(() => setGo(true), { timeout: 3000 });
      else timer = setTimeout(() => setGo(true), 1200);
    };
    if (document.readyState === "complete") start();
    else window.addEventListener("load", start, { once: true });
    return () => {
      window.removeEventListener("load", start);
      if (idle) cancelIdleCallback(idle);
      if (timer) clearTimeout(timer);
    };
  }, []);

  return <div className={className}>{go && <YumonMascot status="ready" toggle={false} className="h-full w-full" />}</div>;
}
