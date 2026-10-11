'use client';

export function SiteSplash() {
  return (
    <div className="fixed inset-0 z-[99999] flex min-h-dvh items-center justify-center overflow-hidden bg-[#050A16]" aria-label="Loading BetVima" role="status">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(0,125,255,0.10),transparent_32%),linear-gradient(180deg,#071021_0%,#050A16_55%,#03060D_100%)]" />
      <main className="relative flex items-center justify-center translate-x-[0px]">
        <div className="relative flex items-center justify-center translate-x-[0px]">
          <div className="absolute h-[180px] w-[280px] rounded-full bg-[#087DFF]/[0.07] blur-[55px] animate-[betGlow_2.4s_ease-in-out_infinite]" />
          <img src="/brand/betvima-logo-transparent.png" alt="BetVima" className="relative w-[230px] max-w-[62vw] opacity-90 drop-shadow-[0_0_28px_rgba(21,151,255,0.28)] animate-[betPulse_2.4s_ease-in-out_infinite]" />
        </div>
      </main>
      <style jsx global>{`
        @keyframes betPulse {
          0%, 100% { opacity: .72; transform: scale(.985); }
          50% { opacity: 1; transform: scale(1.015); }
        }
        @keyframes betGlow {
          0%, 100% { opacity: .22; transform: scale(.9); }
          50% { opacity: .65; transform: scale(1.08); }
        }
        @media (prefers-reduced-motion: reduce) {
          [class*="animate-[bet"] { animation: none !important; }
        }
      `}</style>
    </div>
  );
}
