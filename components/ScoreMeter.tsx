// Ten-cell meter for a 1-10 score, drawn like a gauge on a spec sheet.
export function ScoreMeter({ value, className = "" }: { value: number; className?: string }) {
  const filled = Math.round(value);
  return (
    <div className={`flex gap-[3px] ${className}`} role="img" aria-label={`${value} out of 10`}>
      {Array.from({ length: 10 }, (_, i) => (
        <span
          key={i}
          className={`h-2 flex-1 ${i < filled ? (value >= 8 ? "bg-accent" : "bg-ink-400") : "border border-line/20"}`}
        />
      ))}
    </div>
  );
}

export function ScoreBadge({ value }: { value: number }) {
  return (
    <div className="text-right">
      <div className="text-[10px] tracking-[0.12em] text-ink-500">SCORE</div>
      <div className={`font-display text-2xl leading-none font-bold ${value >= 8 ? "text-accent" : "text-ink-100"}`}>
        {value.toFixed(1)}
      </div>
    </div>
  );
}
