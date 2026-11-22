import type { CSSProperties } from "react";
import { ProceduralCanvas } from "./ProceduralCanvas";
import { splitTitle, titleScale, rng, type IntroScene } from "@/lib/experience";

function Words({ text, from, seed }: { text: string; from: number; seed: number }) {
  const next = rng(seed + from);
  const words = text.split(/\s+/).filter(Boolean);
  return words.map((word, i) => (
    <span key={i}>
      <span
        className="exp-word"
        style={{ "--i": from + i, "--d": Math.round(40 + next() * 140) } as CSSProperties}
      >
        <span>{word}</span>
      </span>
      {i < words.length - 1 ? " " : null}
    </span>
  ));
}

// The first screen of a post: its procedural scene, the title set huge with
// a staggered reveal, and the post's index, kind and reading time. The title
// words drift apart at different rates as the intro scrolls away (--exit).
export function PostIntro({
  title,
  label,
  number,
  date,
  dateLabel,
  minutes,
  score,
  scene,
}: {
  title: string;
  label: string;
  number: number;
  date: string;
  dateLabel: string;
  minutes: number;
  score?: number;
  scene: IntroScene;
}) {
  const { lead, tail } = splitTitle(title);
  const leadCount = lead.split(/\s+/).filter(Boolean).length;
  const seedHex = scene.seed.toString(16).padStart(8, "0").slice(0, 6).toUpperCase();
  const { accent, second, deep } = scene.palette;

  return (
    <header
      data-scroll-p
      data-intro={scene.program}
      className="exp-intro relative isolate mt-5 overflow-hidden border border-line/18"
      style={{
        background: `radial-gradient(120% 90% at 80% 10%, ${deep} 0%, transparent 60%), radial-gradient(90% 80% at 10% 100%, color-mix(in srgb, ${second} 18%, transparent) 0%, transparent 55%), #050608`,
      } as CSSProperties}
    >
      <div className="exp-intro-stage absolute inset-0 -z-10">
        <ProceduralCanvas scene={scene} />
      </div>
      <div className="exp-intro-shade pointer-events-none absolute inset-0 -z-10" />
      <div className="exp-grain pointer-events-none absolute inset-0 -z-10" />

      <div className="relative flex h-full flex-col justify-between p-5 sm:p-8">
        <div className="exp-intro-meta flex items-start justify-between gap-4 text-[10px] tracking-[0.22em] text-ink-300 sm:text-[11px]">
          <span>
            INDIE MACHINE <span className="text-accent">/</span> Nº {String(number).padStart(3, "0")}
          </span>
          <span className="text-right">
            PROCEDURAL INTRO
            <br />
            <span className="text-ink-500">
              {scene.program.toUpperCase()} · {seedHex}
            </span>
          </span>
        </div>

        <div>
          <div className="exp-kicker mb-4 flex items-center gap-3 text-[11px] tracking-[0.22em] text-accent">
            <span className="h-px w-10 bg-accent" aria-hidden="true" />
            {label.toUpperCase()}
          </div>
          <h1 className={`exp-title exp-title--${titleScale(title)}`} style={{ "--accent-2": second } as CSSProperties}>
            <Words text={lead} from={0} seed={scene.seed} />
            {tail && (
              <span className={`exp-title-tail ${tail.length > 64 ? "exp-title-tail--long" : ""}`}>
                {" "}
                <Words text={tail} from={leadCount} seed={scene.seed} />
              </span>
            )}
          </h1>
          <div className="exp-intro-meta mt-6 flex flex-wrap items-end justify-between gap-4 text-[11px] tracking-[0.18em] text-ink-300">
            <span>
              <time dateTime={date}>{dateLabel.toUpperCase()}</time>
              <span className="mx-2 text-accent">·</span>
              {minutes} MIN READ
            </span>
            <span className="flex items-end gap-6">
              {score !== undefined && (
                <span className="text-right">
                  <span className="block text-[9px] text-ink-400">SCORE</span>
                  <span className="font-display text-4xl leading-none font-bold tracking-normal" style={{ color: accent }}>
                    {score.toFixed(1)}
                  </span>
                </span>
              )}
              <span className="exp-scroll-cue flex items-center gap-2 text-ink-400" aria-hidden="true">
                SCROLL <span className="exp-scroll-line" />
              </span>
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
