// Impression badges on game announcements. Deliberately styled apart from the
// accent-blue chips used elsewhere: amber, with a diamond mark.

export function GameBadge({ children, size = "sm" }: { children: React.ReactNode; size?: "sm" | "lg" }) {
  const sizing =
    size === "lg" ? "gap-2 px-3 py-1.5 text-xs tracking-[0.08em]" : "gap-1.5 px-2 py-0.5 text-[10px] tracking-[0.06em]";
  return (
    <span
      className={`inline-flex items-center border border-badge/60 bg-badge/10 font-semibold text-badge uppercase shadow-[0_0_12px_-4px_var(--color-badge)] ${sizing}`}
    >
      <span aria-hidden className="text-[0.8em]">◆</span>
      {children}
    </span>
  );
}

export function BadgeList({
  badges,
  max,
  size = "sm",
  className = "",
}: {
  badges: string[];
  max?: number;
  size?: "sm" | "lg";
  className?: string;
}) {
  const shown = max ? badges.slice(0, max) : badges;
  const extra = badges.length - shown.length;
  return (
    <ul className={`flex flex-wrap gap-2 ${className}`} aria-label="Impression badges">
      {shown.map((b) => (
        <li key={b}>
          <GameBadge size={size}>{b}</GameBadge>
        </li>
      ))}
      {extra > 0 && <li className="self-center text-[10px] text-ink-500">+{extra}</li>}
    </ul>
  );
}
