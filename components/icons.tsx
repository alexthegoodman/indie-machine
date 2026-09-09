export function CrosshairIcon({ className }: { className?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" className={className}>
      <circle cx="10" cy="10" r="6" stroke="currentColor" strokeWidth="1" />
      <line x1="10" y1="0" x2="10" y2="20" stroke="currentColor" strokeWidth="1" />
      <line x1="0" y1="10" x2="20" y2="10" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}

export function CornerMark({ className }: { className?: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" className={className}>
      <path d="M1,11 L1,1 L11,1" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export function ChevronRight({ className }: { className?: string }) {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className={className}>
      <path d="M3,1 L8,5 L3,9" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}

export function ChevronLeft({ className }: { className?: string }) {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className={className}>
      <path d="M7,1 L2,5 L7,9" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}

export function WaveIcon({ className }: { className?: string }) {
  return (
    <svg width="36" height="36" viewBox="0 0 36 36" fill="none" className={className}>
      <path
        d="M2,20 C6,12 10,28 14,20 C18,12 22,28 26,20 C29,14 32,26 34,20"
        stroke="currentColor"
        strokeWidth="1.3"
      />
    </svg>
  );
}

export function RippleIcon({ className }: { className?: string }) {
  return (
    <svg width="36" height="36" viewBox="0 0 36 36" fill="none" className={className}>
      <circle cx="18" cy="18" r="4" stroke="currentColor" strokeWidth="1.3" />
      <circle cx="18" cy="18" r="10" stroke="currentColor" strokeWidth="1.1" opacity="0.7" />
      <circle cx="18" cy="18" r="16" stroke="currentColor" strokeWidth="1" opacity="0.4" />
    </svg>
  );
}

export function PanelIcon({ className }: { className?: string }) {
  return (
    <svg width="36" height="36" viewBox="0 0 36 36" fill="none" className={className}>
      <rect x="2" y="4" width="32" height="28" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
      <line x1="16" y1="4" x2="16" y2="32" stroke="currentColor" strokeWidth="1.1" />
      <line x1="16" y1="18" x2="34" y2="18" stroke="currentColor" strokeWidth="1.1" />
    </svg>
  );
}

export function DocIcon({ className }: { className?: string }) {
  return (
    <svg width="36" height="36" viewBox="0 0 36 36" fill="none" className={className}>
      <rect x="6" y="3" width="24" height="30" rx="1" stroke="currentColor" strokeWidth="1.3" />
      <line x1="11" y1="12" x2="25" y2="12" stroke="currentColor" strokeWidth="1.1" />
      <line x1="11" y1="18" x2="25" y2="18" stroke="currentColor" strokeWidth="1.1" />
      <line x1="11" y1="24" x2="20" y2="24" stroke="currentColor" strokeWidth="1.1" />
    </svg>
  );
}

export function GithubIcon({ className }: { className?: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" className={className}>
      <path d="M8 0C3.58 0 0 3.67 0 8.2c0 3.62 2.29 6.7 5.47 7.79.4.08.55-.18.55-.39 0-.19-.01-.83-.01-1.51-2.01.38-2.53-.5-2.69-.96-.09-.24-.48-.96-.82-1.16-.28-.15-.68-.53-.01-.54.63-.01 1.08.59 1.23.83.72 1.23 1.87.88 2.33.67.07-.53.28-.88.51-1.08-1.78-.2-3.64-.91-3.64-4.02 0-.89.31-1.62.82-2.19-.08-.2-.36-1.04.08-2.16 0 0 .67-.22 2.2.84a7.4 7.4 0 0 1 4 0c1.53-1.06 2.2-.84 2.2-.84.44 1.12.16 1.96.08 2.16.51.57.82 1.29.82 2.19 0 3.12-1.87 3.82-3.65 4.02.29.26.54.76.54 1.53 0 1.11-.01 2-.01 2.27 0 .21.15.48.55.39A8.21 8.21 0 0 0 16 8.2C16 3.67 12.42 0 8 0Z" />
    </svg>
  );
}

// Maps a post slug to one of the icons above; unknown slugs fall back to a
// generic document mark so new posts always render something sensible.
export function iconForSlug(slug: string) {
  if (slug.includes("ripple")) return RippleIcon;
  if (slug.includes("egui") || slug.includes("gui")) return PanelIcon;
  if (slug.includes("fft") || slug.includes("ocean") || slug.includes("water")) return WaveIcon;
  return DocIcon;
}
