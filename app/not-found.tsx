import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col">
      <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <div className="text-[13px] tracking-[0.14em] text-accent">// SHEET NOT FOUND</div>
        <h1 className="mt-4 font-display text-6xl font-bold text-ink-100">404</h1>
        <p className="mt-4 max-w-sm text-ink-400">
          Nothing&apos;s logged at this address.
        </p>
        <Link href="/" className="mt-8 text-sm tracking-wide text-accent">
          ← BACK TO LATEST
        </Link>
      </div>
    </div>
  );
}
