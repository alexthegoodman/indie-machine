import type { ReactNode } from "react";

export function P({ children }: { children: ReactNode }) {
  return <p className="mb-4 max-w-3xl font-display text-[17px] leading-relaxed text-ink-300 [&_strong]:text-ink-100">{children}</p>;
}

export function Lead({ children }: { children: ReactNode }) {
  return <p className="mb-5 max-w-3xl font-display text-xl leading-relaxed text-ink-100 md:text-2xl">{children}</p>;
}

export function Formula({ children, note }: { children: ReactNode; note?: ReactNode }) {
  return (
    <div className="my-5 border-l-2 border-badge bg-panel/30 px-4 py-3">
      <div className="overflow-x-auto font-mono text-base whitespace-nowrap text-ink-100 md:text-lg">{children}</div>
      {note && <div className="mt-1.5 text-xs text-ink-400">{note}</div>}
    </div>
  );
}

export function Note({ title = "NOTE", children }: { title?: string; children: ReactNode }) {
  return (
    <aside className="my-5 max-w-3xl border border-accent/25 bg-accent/5 px-4 py-3 text-sm leading-relaxed text-ink-300">
      <div className="mb-1 text-[10px] tracking-[0.16em] text-accent">{title}</div>
      {children}
    </aside>
  );
}

export function Bullets({ items }: { items: ReactNode[] }) {
  return (
    <ul className="mb-4 flex max-w-3xl flex-col gap-2 font-display text-[16px] leading-relaxed text-ink-300">
      {items.map((it, i) => (
        <li key={i} className="flex gap-3">
          <span className="mt-2.5 h-1.5 w-1.5 shrink-0 bg-accent" aria-hidden="true" />
          <span>{it}</span>
        </li>
      ))}
    </ul>
  );
}

export function Table({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  return (
    <div className="my-4 overflow-x-auto">
      <table className="w-full min-w-[520px] border-collapse text-left text-[13px]">
        <thead>
          <tr>
            {head.map((h) => (
              <th key={h} className="border-b border-line/28 py-2 pr-4 text-[10px] font-normal tracking-[0.14em] text-ink-500">
                {h.toUpperCase()}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-line/10 align-top">
              {r.map((c, j) => (
                <td key={j} className="py-2 pr-4 text-ink-300 [&_code]:text-[12px]">
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
