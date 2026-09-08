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

// Maps a post slug to one of the icons above; unknown slugs fall back to a
// generic document mark so new posts always render something sensible.
export function iconForSlug(slug: string) {
  if (slug.includes("ripple")) return RippleIcon;
  if (slug.includes("egui") || slug.includes("gui")) return PanelIcon;
  if (slug.includes("fft") || slug.includes("ocean") || slug.includes("water")) return WaveIcon;
  return DocIcon;
}
