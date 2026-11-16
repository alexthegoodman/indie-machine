// Small presentational pieces shared by the product and dev explorers.

export function SearchField({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <label className="flex items-center gap-3 border border-line/28 px-4 py-3 focus-within:border-accent/70">
      <span className="text-[11px] tracking-[0.14em] text-accent">SEARCH</span>
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="min-w-0 flex-1 bg-transparent font-display text-base text-ink-100 placeholder:text-ink-500 focus:outline-none"
      />
    </label>
  );
}

export function Chip({
  active,
  onClick,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`h-9 shrink-0 cursor-pointer border px-3 text-[11px] tracking-[0.06em] whitespace-nowrap transition-colors ${
        active
          ? "border-ink-100 bg-ink-100 text-ink [&_span]:text-ink/60"
          : "border-line/28 text-ink-300 hover:border-accent/60 hover:text-ink-100"
      }`}
    >
      {children}
    </button>
  );
}

export function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="flex items-center gap-2 border border-line/25 px-3 py-1.5 focus-within:border-accent/70">
      <span className="text-[10px] tracking-[0.12em] text-ink-500">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="cursor-pointer bg-ink text-[12px] text-ink-100 focus:outline-none"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
