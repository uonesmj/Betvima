'use client';

import { useEffect, useState } from 'react';

export type VerifiedClock = {
  minute?: number | null;
  clockSeconds?: number | null;
  clockRunning?: boolean;
  clockObservedAt?: string | null;
};

/** A paused clock stays paused. Only a confirmed TT=1 clock can run locally. */
export function useVerifiedClock(source: VerifiedClock | null | undefined): number | null {
  const [tick, setTick] = useState(0);
  const observed = source?.clockObservedAt;
  const seconds = source?.clockSeconds;
  const running = source?.clockRunning;
  useEffect(() => {
    setTick(0);
    if (!running || seconds == null) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') setTick(t => Math.min(t + 1, 60));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [observed, seconds, running]);
  // A card snapshot can be up to 45s old when its event is opened.
  // Anchor both screens to the SAME provider observation rather than the
  // mount time of each component. Never extrapolate stale observations.
  const received = observed ? Date.parse(observed) : NaN;
  const age = Number.isFinite(received)
    ? Math.floor((Date.now() - received) / 1000) : tick;
  const elapsed = running && age >= 0 && age <= 60 ? age : 0;
  return seconds == null ? null : seconds + elapsed;
}
export function VerifiedClockText({ source, fallback = 'LIVE' }: {
  source: VerifiedClock | null | undefined; fallback?: string;
}) {
  const value = useVerifiedClock(source);
  if (value != null) return <>{Math.floor(value/60)}:{String(value%60).padStart(2,'0')}</>;
  return <>{source?.minute != null ? source.minute + '′' : fallback}</>;
}
