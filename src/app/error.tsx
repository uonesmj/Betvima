'use client';

import { useEffect } from 'react';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(JSON.stringify({ level: 'error', msg: 'ui.error', message: error.message, digest: error.digest })); }, [error]);
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-3 p-6 text-center">
      <h1 className="text-lg font-bold">Something went wrong</h1>
      <p className="text-sm nova-muted">The error was logged with a correlation id. Your balance and bets are unaffected.</p>
      <button type="button" className="nova-btn-primary" onClick={reset}>Try again</button>
    </div>
  );
}
