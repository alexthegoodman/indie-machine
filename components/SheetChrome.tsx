// Fixed, viewport-anchored grid - the "blueprint sheet" that sits behind
// every page of the app shell.
export function SheetChrome() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0"
      style={{
        backgroundImage:
          "repeating-linear-gradient(0deg, rgba(219,234,254,0.05) 0px, rgba(219,234,254,0.05) 1px, transparent 1px, transparent 40px), repeating-linear-gradient(90deg, rgba(219,234,254,0.05) 0px, rgba(219,234,254,0.05) 1px, transparent 1px, transparent 40px)",
      }}
    />
  );
}
