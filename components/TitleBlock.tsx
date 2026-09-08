export function TitleBlock({
  cells,
}: {
  cells: { label: string; value: string; accent?: boolean }[];
}) {
  return (
    <div className="inline-flex flex-wrap border border-line/28">
      {cells.map((cell, i) => (
        <div
          key={cell.label}
          className={`px-4 py-3 ${i < cells.length - 1 ? "border-r border-line/28" : ""}`}
        >
          <div className="text-[10px] tracking-[0.12em] text-ink-500">{cell.label}</div>
          <div className={`mt-1 text-[13px] ${cell.accent ? "text-accent" : "text-ink-100"}`}>
            {cell.value}
          </div>
        </div>
      ))}
    </div>
  );
}
