// Stroke icons for the app shell, drawn on a 24px grid in the same thin-line
// style as the blueprint marks in ../icons.tsx.

type IconProps = { className?: string; size?: number; filled?: boolean };

function Svg({ className, size = 20, filled, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {children}
    </svg>
  );
}

export const HomeIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 10.5 12 3l9 7.5V21h-6v-6H9v6H3z" />
  </Svg>
);
export const ReviewIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M9 3h6v3H9z" />
    <path d="M7 4.5H5V21h14V4.5h-2" />
    <path d="m9 13.5 2 2 4-4" />
  </Svg>
);
export const TerminalIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 5h16v14H4z" />
    <path d="m8 10 2 2-2 2" />
    <path d="M12 15h4" />
  </Svg>
);
export const DiamondIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 3 21 12 12 21 3 12z" />
    <path d="M12 8 16 12 12 16 8 12z" />
  </Svg>
);
export const GamepadIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6 8h12a4 4 0 0 1 4 4v2a3 3 0 0 1-5.4 1.8L15 14H9l-1.6 1.8A3 3 0 0 1 2 14v-2a4 4 0 0 1 4-4z" />
    <path d="M8 10v4M6 12h4" />
  </Svg>
);
export const SparkIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6" />
  </Svg>
);
export const BookmarkIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6 3h12v18l-6-4-6 4z" />
  </Svg>
);
export const ClockIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </Svg>
);
export const SearchIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-4-4" />
  </Svg>
);
export const MenuIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 6h16M4 12h16M4 18h16" />
  </Svg>
);
export const ShareIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 12v8h16v-8" />
    <path d="M12 3v12" />
    <path d="m7 8 5-5 5 5" />
  </Svg>
);
export const ExternalIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M14 4h6v6" />
    <path d="M20 4 10 14" />
    <path d="M18 14v6H4V6h6" />
  </Svg>
);
export const CapIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="m2 9 10-5 10 5-10 5z" />
    <path d="M6 11v5c0 1.5 3 3 6 3s6-1.5 6-3v-5" />
    <path d="M22 9v6" />
  </Svg>
);
export const CodeIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="m8 8-4 4 4 4M16 8l4 4-4 4" />
  </Svg>
);
export const ChevronLeftIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="m15 6-6 6 6 6" />
  </Svg>
);
export const ChevronRightIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="m9 6 6 6-6 6" />
  </Svg>
);
export const CloseIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Svg>
);
export const RssIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5 5a14 14 0 0 1 14 14" />
    <path d="M5 11a8 8 0 0 1 8 8" />
    <circle cx="6" cy="18" r="1" />
  </Svg>
);
export const ListIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M9 6h11M9 12h11M9 18h11" />
    <path d="M4 6h.01M4 12h.01M4 18h.01" />
  </Svg>
);
export const RocketIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M14 4c3-1 5-1 6 0 1 1 1 3 0 6l-6 6-6-6z" />
    <path d="m8 10-3 1-2 3 4 1M14 16l-1 3-3 2-1-4" />
    <circle cx="15.5" cy="8.5" r="1.5" />
  </Svg>
);
export const PlusIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 5v14M5 12h14" />
  </Svg>
);
