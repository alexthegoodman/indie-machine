import { ChevronLeft, ChevronRight } from "./icons";

export function SectionDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 px-6 py-6 md:gap-4 md:px-24 md:py-8">
      <ChevronLeft className="shrink-0 text-accent" />
      <div
        className="h-px flex-1 opacity-60"
        style={{
          backgroundImage:
            "repeating-linear-gradient(90deg, var(--color-accent) 0, var(--color-accent) 4px, transparent 4px, transparent 9px)",
        }}
      />
      <div className="whitespace-nowrap text-[11px] tracking-[0.18em] text-accent md:text-xs">
        {label}
      </div>
      <div
        className="h-px flex-1 opacity-60"
        style={{
          backgroundImage:
            "repeating-linear-gradient(90deg, var(--color-accent) 0, var(--color-accent) 4px, transparent 4px, transparent 9px)",
        }}
      />
      <ChevronRight className="shrink-0 text-accent" />
    </div>
  );
}
