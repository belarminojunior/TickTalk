import type { SVGProps } from 'react';
import type { SquareIcon } from '../game/board';

type IconProps = SVGProps<SVGSVGElement> & { size?: number | string };

function Svg({ size = 24, children, strokeWidth = 2, ...rest }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  );
}

export const StarIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 3.2l2.6 5.5 6 .8-4.4 4.2 1.1 6-5.3-2.9-5.3 2.9 1.1-6L3.4 9.5l6-.8z" />
  </Svg>
);

export const GlobeIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.6" />
    <path d="M3.4 12h17.2M12 3.4c2.6 2.4 3.9 5.3 3.9 8.6s-1.3 6.2-3.9 8.6c-2.6-2.4-3.9-5.3-3.9-8.6s1.3-6.2 3.9-8.6z" />
  </Svg>
);

export const MusicIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M9 17.5V5.5l11-2v12" />
    <circle cx="6.5" cy="17.5" r="2.6" />
    <circle cx="17.5" cy="15.5" r="2.6" />
  </Svg>
);

export const BallIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.6" />
    <path d="M12 8.2l3.4 2.5-1.3 4h-4.2l-1.3-4z" />
  </Svg>
);

export const FilmIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3.5" y="4.5" width="17" height="15" rx="1.5" />
    <path d="M7.5 4.5v15M16.5 4.5v15M3.5 9h4M3.5 15h4M16.5 9h4M16.5 15h4" />
  </Svg>
);

export const BookIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 6.5c-1.8-1.4-4.6-2-8-2v13c3.4 0 6.2.6 8 2 1.8-1.4 4.6-2 8-2v-13c-3.4 0-6.2.6-8 2z" />
    <path d="M12 6.5v13" />
  </Svg>
);

export const SQUARE_ICONS: Record<SquareIcon, (p: IconProps) => JSX.Element> = {
  star: StarIcon,
  globe: GlobeIcon,
  music: MusicIcon,
  ball: BallIcon,
  film: FilmIcon,
  book: BookIcon,
};

export const ArrowRightIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 12h15M13 6l6 6-6 6" />
  </Svg>
);

export const FlagIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6 21V4M6 4h11l-2.5 4L17 12H6" />
  </Svg>
);

export const CheckIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </Svg>
);

export const XIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6 6l12 12M18 6L6 18" />
  </Svg>
);

export const PlusIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 5v14M5 12h14" />
  </Svg>
);

export const PauseIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M9 5.5v13M15 5.5v13" />
  </Svg>
);

export const PlayIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M7 4.5v15l12-7.5z" />
  </Svg>
);

export const SoundIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" />
    <path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" />
  </Svg>
);

export const MuteIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" />
    <path d="M16 9.5l5 5M21 9.5l-5 5" />
  </Svg>
);

export const DiceIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3.5" y="3.5" width="17" height="17" rx="3.5" />
    <circle cx="8.5" cy="8.5" r="1.3" fill="currentColor" stroke="none" />
    <circle cx="15.5" cy="15.5" r="1.3" fill="currentColor" stroke="none" />
    <circle cx="8.5" cy="15.5" r="1.3" fill="currentColor" stroke="none" />
  </Svg>
);

export const DevicesIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="2.5" y="4" width="14" height="10" rx="1.5" />
    <path d="M7 18h5M9.5 14v4" />
    <rect x="17" y="8" width="5" height="11" rx="1.2" />
  </Svg>
);

export const WindowsIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="2.5" y="5" width="8.5" height="7" rx="1.2" />
    <rect x="13" y="5" width="8.5" height="7" rx="1.2" />
    <path d="M5 16h3.5M15.5 16H19M6.75 12v4M17.25 12v4" />
  </Svg>
);

export const MonitorIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3" y="4" width="18" height="12" rx="1.5" />
    <path d="M9 20h6M12 16v4" />
  </Svg>
);

export const UndoIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M9 14L4 9l5-5" />
    <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
  </Svg>
);

export const ExternalIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
  </Svg>
);

export const SwapIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M7 7h12l-3-3M17 17H5l3 3" />
  </Svg>
);
