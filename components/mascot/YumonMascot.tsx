"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { Status } from "@/lib/yumon/session";
import type { Clip, MascotScene, Variant } from "@/lib/mascot/scene";

/** localStorage: the robot the reader picked last ("bot" or "mech"). `?mascot=` overrides it. */
const VARIANT_KEY = "im_mascot_variant";
const LABELS: Record<Variant, string> = { mech: "MECH", bot: "SOFT" };

const variantListeners = new Set<() => void>();
let picked: Variant | null = null;

function readVariant(): Variant {
  if (picked) return picked;
  try {
    const q = new URLSearchParams(location.search).get("mascot");
    if (q === "bot" || q === "mech") return q;
    const v = localStorage.getItem(VARIANT_KEY);
    if (v === "bot" || v === "mech") return v;
  } catch {
    // Storage blocked: default robot.
  }
  return "mech";
}

function pickVariant(v: Variant) {
  picked = v;
  try {
    localStorage.setItem(VARIANT_KEY, v);
  } catch {
    // Remembered for this page only.
  }
  for (const l of variantListeners) l();
}

const variantStore = {
  subscribe(l: () => void) {
    variantListeners.add(l);
    return () => variantListeners.delete(l);
  },
};

/** The clip Yumon rests in for a chat state. */
function baseClip(status: Status, writing: boolean, hasText: boolean): Clip {
  if (status === "idle") return "doze";
  if (status === "error") return "think";
  if (writing || status === "thinking") return hasText ? "talk" : "think";
  return "idle";
}

// Yumon's robot body above the chat. It sleeps until the model is woken, scratches its head
// while the first token is on the way, talks while the reply streams, cheers when it wakes up
// and waves when clicked. The 3.8 MB model and three.js load only when the stage is on screen;
// without WebGL, or if the model fails to load, the stage removes itself.
export function YumonMascot({
  status,
  writing = false,
  hasText = false,
  toggle = true,
  className = "",
}: {
  status: Status;
  /** A reply is being generated for the chat this mascot sits in. */
  writing?: boolean;
  /** That reply has text yet. */
  hasText?: boolean;
  /** Show the MECH / SOFT look picker. */
  toggle?: boolean;
  className?: string;
}) {
  const variant = useSyncExternalStore(variantStore.subscribe, readVariant, () => "mech" as Variant);
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<MascotScene | null>(null);
  const [seen, setSeen] = useState(false);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const base = baseClip(status, writing, hasText);
  const baseRef = useRef(base);
  baseRef.current = base;
  const prevStatus = useRef(status);

  // Nothing loads until the stage is on screen once.
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) setSeen(true);
      sceneRef.current?.setActive(e.isIntersecting && !document.hidden);
    });
    io.observe(el);
    const onVis = () => sceneRef.current?.setActive(!document.hidden && isOnScreen(el));
    document.addEventListener("visibilitychange", onVis);
    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  useEffect(() => {
    if (!seen || failed) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cancelled = false;
    let made: MascotScene | null = null;
    setReady(false);
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    void (async () => {
      try {
        const { createMascot } = await import("@/lib/mascot/scene");
        made = await createMascot(canvas, variant, { still, base: baseRef.current });
        if (cancelled) return made.dispose();
        sceneRef.current = made;
        made.setActive(!document.hidden && isOnScreen(stageRef.current));
        if (baseRef.current === "idle") made.play("wave");
        setReady(true);
      } catch (e) {
        if (!cancelled) {
          console.warn("Yumon mascot unavailable:", e);
          setFailed(true);
        }
      }
    })();
    return () => {
      cancelled = true;
      made?.dispose();
      sceneRef.current = null;
    };
  }, [seen, variant, failed]);

  useEffect(() => {
    sceneRef.current?.setBase(base);
  }, [base, ready]);

  // Waking up earns a cheer.
  useEffect(() => {
    if (prevStatus.current === "loading" && status === "ready") sceneRef.current?.play("cheer");
    prevStatus.current = status;
  }, [status]);

  if (failed) return null;

  return (
    <div ref={stageRef} className={`relative overflow-hidden ${className}`} data-testid="yumon-mascot" data-variant={variant} data-clip={base} data-ready={ready || undefined}>
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 bg-[radial-gradient(ellipse_at_50%_100%,color-mix(in_srgb,var(--color-accent)_14%,transparent),transparent_70%)]"
        aria-hidden="true"
      />
      <button
        type="button"
        onClick={() => sceneRef.current?.play("wave")}
        aria-label="Wave at Yumon"
        className="absolute inset-0 cursor-pointer focus-visible:outline-offset-[-2px]"
      >
        <canvas ref={canvasRef} className={`h-full w-full transition-opacity duration-500 ${ready ? "opacity-100" : "opacity-0"}`} aria-hidden="true" />
      </button>
      {!ready && (
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-[10px] tracking-[0.14em] text-ink-500" aria-hidden="true">
          {seen ? "ASSEMBLING..." : ""}
        </span>
      )}
      {toggle && (
        <div className="absolute top-2 right-2 flex border border-line/22 bg-ink/70 text-[9px] tracking-[0.12em]" role="group" aria-label="Yumon's look">
          {(Object.keys(LABELS) as Variant[]).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => pickVariant(v)}
              aria-pressed={v === variant}
              className={`h-6 cursor-pointer px-2 ${v === variant ? "bg-accent/15 text-accent" : "text-ink-500 hover:text-ink-100"}`}
            >
              {LABELS[v]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function isOnScreen(el: HTMLElement | null): boolean {
  if (!el || !el.offsetParent) return false;
  const r = el.getBoundingClientRect();
  return r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth;
}
