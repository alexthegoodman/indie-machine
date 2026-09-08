import { CornerMark } from "./icons";

// Fixed, viewport-anchored grid + corner registration marks - the
// "blueprint sheet" frame that sits behind every page.
export function SheetChrome() {
  return (
    <>
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, rgba(219,234,254,0.06) 0px, rgba(219,234,254,0.06) 1px, transparent 1px, transparent 40px), repeating-linear-gradient(90deg, rgba(219,234,254,0.06) 0px, rgba(219,234,254,0.06) 1px, transparent 1px, transparent 40px)",
        }}
      />
      <CornerMark className="pointer-events-none fixed top-4 left-4 z-10 text-line/55 md:top-6 md:left-6" />
      <CornerMark className="pointer-events-none fixed top-4 right-4 z-10 -scale-x-100 text-line/55 md:top-6 md:right-6" />
      <CornerMark className="pointer-events-none fixed bottom-4 left-4 z-10 -scale-y-100 text-line/55 md:bottom-6 md:left-6" />
      <CornerMark className="pointer-events-none fixed bottom-4 right-4 z-10 scale-[-1] text-line/55 md:bottom-6 md:right-6" />
    </>
  );
}
