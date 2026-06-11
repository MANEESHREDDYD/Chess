import type { ReactNode, SVGProps } from 'react';

/**
 * MIRROR Nova icon system. One consistent family of inline SVGs so we never
 * ship random/basic icons or emoji for primary controls.
 *
 * Rules: stroke-only, stroke width 1.75, currentColor, round caps/joins,
 * sizes 16 / 18 / 20 only (default 18). No external icon dependency.
 */

export type IconSize = 16 | 18 | 20;

export type IconProps = Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> & {
  size?: IconSize;
  title?: string;
};

function IconBase({ size = 18, title, children, ...props }: IconProps & { children: ReactNode }) {
  return (
    <svg
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      focusable="false"
      {...props}
    >
      {title ? <title>{title}</title> : null}
      {children}
    </svg>
  );
}

export const PlayIcon = (p: IconProps) => (
  <IconBase {...p}>
    <path d="M7 5.5v13a1 1 0 0 0 1.52.86l10-6.5a1 1 0 0 0 0-1.72l-10-6.5A1 1 0 0 0 7 5.5Z" />
  </IconBase>
);

export const MirrorIcon = (p: IconProps) => (
  <IconBase {...p}>
    <rect x="4" y="3" width="16" height="18" rx="3" />
    <path d="M12 3v18" />
    <path d="M8.5 8.5 6.5 12l2 3.5" />
    <path d="M15.5 8.5 17.5 12l-2 3.5" />
  </IconBase>
);

export const StoryIcon = (p: IconProps) => (
  <IconBase {...p}>
    <path d="M12 6.5C10.5 5 8.5 4.5 5 4.5v13c3.5 0 5.5.5 7 2 1.5-1.5 3.5-2 7-2v-13c-3.5 0-5.5.5-7 2Z" />
    <path d="M12 6.5v12.5" />
  </IconBase>
);

export const ClueIcon = (p: IconProps) => (
  <IconBase {...p}>
    <path d="M9 18h6" />
    <path d="M10 21h4" />
    <path d="M12 3a6 6 0 0 0-3.5 10.9c.6.45 1 1.16 1 1.93V16h5v-.17c0-.77.4-1.48 1-1.93A6 6 0 0 0 12 3Z" />
  </IconBase>
);

export const AnalyticsIcon = (p: IconProps) => (
  <IconBase {...p}>
    <path d="M4 20h16" />
    <path d="M7 20v-6" />
    <path d="M12 20V8" />
    <path d="M17 20v-9" />
  </IconBase>
);

export const ProfileIcon = (p: IconProps) => (
  <IconBase {...p}>
    <circle cx="12" cy="8" r="3.5" />
    <path d="M5 20a7 7 0 0 1 14 0" />
  </IconBase>
);

export const MoreIcon = (p: IconProps) => (
  <IconBase {...p}>
    <circle cx="5" cy="12" r="1.4" />
    <circle cx="12" cy="12" r="1.4" />
    <circle cx="19" cy="12" r="1.4" />
  </IconBase>
);

export const ImportIcon = (p: IconProps) => (
  <IconBase {...p}>
    <path d="M12 3v11" />
    <path d="m8 10 4 4 4-4" />
    <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
  </IconBase>
);

export const CoachIcon = (p: IconProps) => (
  <IconBase {...p}>
    <path d="M3 9.5 12 5l9 4.5-9 4.5-9-4.5Z" />
    <path d="M7 11.5v4c0 1.3 2.2 2.5 5 2.5s5-1.2 5-2.5v-4" />
    <path d="M21 9.5V15" />
  </IconBase>
);

export const CalibrationIcon = (p: IconProps) => (
  <IconBase {...p}>
    <path d="M4 8h10" />
    <path d="M18 8h2" />
    <circle cx="16" cy="8" r="2" />
    <path d="M4 16h4" />
    <path d="M12 16h8" />
    <circle cx="10" cy="16" r="2" />
  </IconBase>
);

export const DiagnosticsIcon = (p: IconProps) => (
  <IconBase {...p}>
    <path d="M3 12h4l2 6 4-14 2 8h6" />
  </IconBase>
);

export const SunIcon = (p: IconProps) => (
  <IconBase {...p}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </IconBase>
);

export const MoonIcon = (p: IconProps) => (
  <IconBase {...p}>
    <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z" />
  </IconBase>
);

export const ChevronDownIcon = (p: IconProps) => (
  <IconBase {...p}>
    <path d="m6 9 6 6 6-6" />
  </IconBase>
);

export const VolumeIcon = (p: IconProps) => (
  <IconBase {...p}>
    <path d="M4 9v6h3l5 4V5L7 9H4Z" />
    <path d="M16 8.5a4 4 0 0 1 0 7" />
    <path d="M18.5 6a7 7 0 0 1 0 12" />
  </IconBase>
);

export const MuteIcon = (p: IconProps) => (
  <IconBase {...p}>
    <path d="M4 9v6h3l5 4V5L7 9H4Z" />
    <path d="m16 9 5 6M21 9l-5 6" />
  </IconBase>
);

export const BoardIcon = (p: IconProps) => (
  <IconBase {...p}>
    <rect x="3" y="3" width="18" height="18" rx="2.5" />
    <path d="M9 3v18M15 3v18M3 9h18M3 15h18" />
  </IconBase>
);

export const ReviewIcon = (p: IconProps) => (
  <IconBase {...p}>
    <path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1" />
    <path d="M5 3v3.5h3.5" />
    <path d="M12 8v4l3 2" />
  </IconBase>
);

export const WarningIcon = (p: IconProps) => (
  <IconBase {...p}>
    <path d="M12 4 2.5 20h19L12 4Z" />
    <path d="M12 10v4" />
    <path d="M12 17.5h.01" />
  </IconBase>
);

export const SuccessIcon = (p: IconProps) => (
  <IconBase {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="m8.5 12 2.5 2.5L16 9" />
  </IconBase>
);

export const CheckIcon = (p: IconProps) => (
  <IconBase {...p}>
    <path d="m5 12.5 4.5 4.5L19 7" />
  </IconBase>
);

export const LockIcon = (p: IconProps) => (
  <IconBase {...p}>
    <rect x="5" y="11" width="14" height="9" rx="2" />
    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
  </IconBase>
);

export const InfoIcon = (p: IconProps) => (
  <IconBase {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5" />
    <path d="M12 8h.01" />
  </IconBase>
);

/** Named registry for data-driven usage (nav, menus). */
export const NovaIcons = {
  play: PlayIcon,
  mirror: MirrorIcon,
  story: StoryIcon,
  clue: ClueIcon,
  analytics: AnalyticsIcon,
  profile: ProfileIcon,
  more: MoreIcon,
  import: ImportIcon,
  coach: CoachIcon,
  calibration: CalibrationIcon,
  diagnostics: DiagnosticsIcon,
  sun: SunIcon,
  moon: MoonIcon,
  chevronDown: ChevronDownIcon,
  volume: VolumeIcon,
  mute: MuteIcon,
  board: BoardIcon,
  review: ReviewIcon,
  warning: WarningIcon,
  success: SuccessIcon,
  check: CheckIcon,
  lock: LockIcon,
} as const;

export type NovaIconName = keyof typeof NovaIcons;
