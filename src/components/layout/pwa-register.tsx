'use client';

import { useEffect } from 'react';

export function PwaRegister() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

    void navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {
      // PWA registration is non-critical; the application continues normally.
    });
  }, []);

  return null;
}
