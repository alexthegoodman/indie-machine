import type { ReactNode } from "react";

export function VizFrame({ label, caption, children }: { label: string; caption?: ReactNode; children: ReactNode }) {
  return (
    <figure className="my-5 border border-accent/30 bg-ink/60">
      <div className="flex items-center gap-2 border-b border-accent/20 px-4 py-2 text-[10px] tracking-[0.18em] text-accent">
        <span className="h-1.5 w-1.5 bg-accent" aria-hidden="true" /> INTERACTIVE / {label}
      </div>
      <div className="p-4 sm:p-5">{children}</div>
      {caption && <figcaption className="border-t border-line/12 px-4 py-2.5 text-xs leading-relaxed text-ink-400">{caption}</figcaption>}
    </figure>
  );
}

export function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  format = String,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
}) {
  return (
    <label className="flex min-w-36 flex-1 flex-col gap-1.5 text-[11px] tracking-[0.08em] text-ink-400">
      <span className="flex justify-between gap-2">
        <span>{label}</span>
        <span className="text-ink-100">{format(value)}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="accent-[var(--color-accent)]"
      />
    </label>
  );
}

export function VizButton({ onClick, children, primary }: { onClick: () => void; children: ReactNode; primary?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex h-9 items-center px-3.5 text-[11px] tracking-[0.1em] ${
        primary ? "bg-accent font-semibold text-ink hover:bg-ink-100" : "border border-line/28 text-ink-100 hover:border-accent"
      }`}
    >
      {children}
    </button>
  );
}

/** One fixed color per head / cluster, readable on the dark ink background. */
export const HUES = ["#4fd8ff", "#ffc857", "#ff7aa8", "#7dffa1", "#b49bff", "#ff9d5c", "#5cf2d6", "#f4f1a1"];
