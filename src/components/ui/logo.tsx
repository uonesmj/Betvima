'use client';

import { useState } from 'react';
import { Trophy } from 'lucide-react';
import { getLeagueLogo, logoColorIndex, logoInitial } from '@/lib/team-logo';

export type LogoSize = number | 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl';

const SIZE_PRESETS: Record<Exclude<LogoSize, number>, number> = {
  xs: 20,
  sm: 24,
  md: 28,
  lg: 32,
  xl: 40,
  '2xl': 58,
  '3xl': 76,
};

function resolveSize(size: LogoSize): number {
  return typeof size === 'number' ? size : (SIZE_PRESETS[size] ?? 28);
}

/** Soft deterministic avatar palette (light theme): [background, text]. */
const AVATAR_PALETTE: Array<[string, string]> = [
  ['#EAF3FF', '#1D6FF2'],
  ['#E9F9F0', '#0E9F6E'],
  ['#FFF4E5', '#C77414'],
  ['#FDECEF', '#E0245E'],
  ['#F1EAFE', '#7C3AED'],
  ['#E6F9FA', '#0E8A9E'],
  ['#F2F4F7', '#475569'],
  ['#FFF8E1', '#9A6B00'],
];

function avatarColors(name: string | undefined, theme: 'light' | 'dark'): [string, string] {
  if (theme === 'dark') return ['rgba(255,255,255,0.10)', '#FFFFFF'];
  const entry = AVATAR_PALETTE[logoColorIndex(name)];
  if (entry) return [entry[0], entry[1]];
  return ['#F2F4F7', '#475569'];
}

interface LogoBaseProps {
  /** Image URL. When missing (or when it fails to load) a fallback avatar renders. */
  url?: string | null;
  /** Display name — used for the fallback initial + deterministic color. */
  name?: string | null;
  size?: LogoSize;
  /** Visual container style. */
  variant?: 'plain' | 'circle' | 'rounded';
  theme?: 'light' | 'dark';
  /** Eager-load the image (use for above-the-fold heroes). */
  eager?: boolean;
  className?: string;
  /** Optional custom fallback node (e.g. a Flame icon). */
  fallback?: React.ReactNode;
}

function LogoFallback({
  name,
  px,
  variant,
  theme,
  icon,
  custom,
}: {
  name?: string | null;
  px: number;
  variant: 'plain' | 'circle' | 'rounded';
  theme: 'light' | 'dark';
  icon: 'initial' | 'trophy';
  custom?: React.ReactNode;
}) {
  if (custom) return <>{custom}</>;

  const [bg, fg] = avatarColors(name ?? undefined, theme);
  const rounded = variant === 'rounded' ? 'rounded-[30%]' : 'rounded-full';
  const border =
    theme === 'dark' ? 'border border-white/15' : variant === 'plain' ? '' : 'border border-[#E0E4E8]';

  return (
    <span
      className={`grid shrink-0 select-none place-items-center ${rounded} ${border}`}
      style={{ width: px, height: px, backgroundColor: bg, color: fg }}
      aria-label={name ?? undefined}
    >
      {icon === 'trophy' ? (
        <Trophy size={Math.max(12, Math.round(px * 0.48))} strokeWidth={1.8} aria-hidden="true" />
      ) : (
        <span style={{ fontSize: Math.max(10, Math.round(px * 0.42)) }} className="font-black leading-none">
          {logoInitial(name)}
        </span>
      )}
    </span>
  );
}

/**
 * Unified team badge.
 * - Plain variant renders just the image (for list rows).
 * - Circle variant renders a white circular badge (for heroes / headers).
 * - Broken or missing URLs always fall back to a deterministic initial avatar.
 */
export function TeamLogo({
  url,
  name,
  size = 'md',
  variant = 'plain',
  theme = 'light',
  eager = false,
  className = '',
  fallback,
}: LogoBaseProps) {
  const [failed, setFailed] = useState(false);
  const px = resolveSize(size);
  const src = !failed && url && url.trim() ? url.trim() : null;

  if (!src) {
    return (
      <LogoFallback name={name} px={px} variant={variant} theme={theme} icon="initial" custom={fallback} />
    );
  }

  if (variant === 'plain') {
    return (
      <img
        src={src}
        alt=""
        loading={eager ? 'eager' : 'lazy'}
        onError={() => setFailed(true)}
        className={`shrink-0 object-contain ${className}`}
        style={{ width: px, height: px }}
      />
    );
  }

  const rounded = variant === 'rounded' ? 'rounded-[30%]' : 'rounded-full';
  const shell =
    theme === 'dark'
      ? 'border border-white/20 bg-white shadow-[0_8px_30px_rgba(0,0,0,.22)]'
      : 'border border-[#E0E4E8] bg-white';

  return (
    <span className={`grid shrink-0 place-items-center ${rounded} ${shell} ${className}`} style={{ width: px, height: px }}>
      <img
        src={src}
        alt=""
        loading={eager ? 'eager' : 'lazy'}
        onError={() => setFailed(true)}
        className="object-contain"
        style={{ width: Math.round(px * 0.72), height: Math.round(px * 0.72) }}
      />
    </span>
  );
}

export interface LeagueLogoProps extends LogoBaseProps {
  sportKey?: string | null;
}

/**
 * Unified league badge with a consistent resolution chain:
 * provider URL -> bundled local badge -> local sport icon -> trophy avatar.
 */
export function LeagueLogo({
  url,
  name,
  sportKey,
  size = 'lg',
  variant = 'plain',
  theme = 'light',
  eager = false,
  className = '',
  fallback,
}: LeagueLogoProps) {
  const [failed, setFailed] = useState(false);
  const px = resolveSize(size);
  const resolved = failed ? null : getLeagueLogo({ url, name, sportKey });

  // getLeagueLogo always returns at least a local sport icon, but the file
  // could still fail (offline / CDN hiccup) — then show the trophy avatar.
  const [iconFailed, setIconFailed] = useState(false);
  const src = !failed && !iconFailed && resolved ? resolved : null;

  if (!src) {
    return (
      <LogoFallback name={name} px={px} variant={variant} theme={theme} icon="trophy" custom={fallback} />
    );
  }

  const handleError = () => {
    // First failure: if we were showing a remote URL, retry with the local
    // fallback chain instead of immediately giving up.
    if (!failed && url && url.trim() && resolved === url.trim()) {
      setFailed(true);
      return;
    }
    setIconFailed(true);
  };

  if (variant === 'plain') {
    return (
      <img
        src={src}
        alt=""
        loading={eager ? 'eager' : 'lazy'}
        onError={handleError}
        className={`shrink-0 object-contain ${className}`}
        style={{ width: px, height: px }}
      />
    );
  }

  const rounded = variant === 'rounded' ? 'rounded-[30%]' : 'rounded-full';
  const shell =
    theme === 'dark'
      ? 'border border-white/15 bg-white/10'
      : 'border border-[#E6E9ED] bg-[#F7F8FA]';

  return (
    <span className={`grid shrink-0 place-items-center ${rounded} ${shell} ${className}`} style={{ width: px, height: px }}>
      <img
        src={src}
        alt=""
        loading={eager ? 'eager' : 'lazy'}
        onError={handleError}
        className="object-contain"
        style={{ width: Math.round(px * 0.72), height: Math.round(px * 0.72) }}
      />
    </span>
  );
}
