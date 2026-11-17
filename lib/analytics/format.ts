// Number and time formatting for /insights (server and client).

export function num(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`;
  if (n >= 10_000) return `${Math.round(n / 1000)}k`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return Math.round(n).toLocaleString("en-US");
}

export function exact(n: number): string {
  return Math.round(n).toLocaleString("en-US");
}

export function pct(x: number, digits = 0): string {
  return `${(x * 100).toFixed(digits)}%`;
}

export function duration(ms: number): string {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${String(s % 60).padStart(2, "0")}s`;
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m`;
}

/** Relative change, or null when there's nothing to compare against. */
export function delta(now: number, prev: number): number | null {
  if (!prev) return null;
  return (now - prev) / prev;
}

/** A Date shown as wall-clock time in `tz`. */
export function when(d: Date | string, tz: string, withSeconds = false): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: withSeconds ? "2-digit" : undefined,
    hourCycle: "h23",
  }).format(typeof d === "string" ? new Date(d) : d);
}

/** A zone-less bucket label ("2026-11-17T14:00") for a chart axis. */
export function bucketLabel(t: string, grain: "hour" | "day" | "week", long = false): string {
  const [date, time] = t.split("T");
  const [y, m, d] = date.split("-").map(Number);
  const month = new Date(Date.UTC(y, m - 1, d)).toLocaleString("en-US", { month: "short", timeZone: "UTC" });
  if (grain === "hour") return long ? `${month} ${d}, ${time}` : time === "00:00" ? `${month} ${d}` : time;
  if (grain === "week") return long ? `Week of ${month} ${d}, ${y}` : `${month} ${d}`;
  return long ? `${month} ${d}, ${y}` : `${month} ${d}`;
}
