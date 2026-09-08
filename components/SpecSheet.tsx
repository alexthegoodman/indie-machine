function formatLabel(key: string): string {
  return key.replace(/_/g, " ").toUpperCase();
}

function Value({ value }: { value: unknown }) {
  if (Array.isArray(value)) {
    return (
      <ul className="mt-1 space-y-0.5">
        {value.map((item, i) => (
          <li key={i} className="text-[13px] text-ink-100">
            {String(item)}
          </li>
        ))}
      </ul>
    );
  }
  return <div className="mt-1 text-[13px] text-ink-100">{String(value)}</div>;
}

// Renders whatever shape a post's frontmatter `crate_versions` happens to
// be in (it varies post to post - some list removed/added crates, others
// just unchanged ones plus edition/os/backend) as a bordered spec table.
export function SpecSheet({ data }: { data: Record<string, unknown> }) {
  const entries = Object.entries(data);
  if (entries.length === 0) return null;

  return (
    <div className="border border-line/28">
      <div className="border-b border-line/28 px-4 py-2 text-[11px] tracking-[0.14em] text-ink-500">
        BUILD SPEC
      </div>
      <div className="grid grid-cols-1 gap-x-8 gap-y-4 px-4 py-4 sm:grid-cols-2">
        {entries.map(([key, value]) => (
          <div key={key}>
            <div className="text-[10px] tracking-[0.12em] text-ink-500">{formatLabel(key)}</div>
            <Value value={value} />
          </div>
        ))}
      </div>
    </div>
  );
}
