import Link from 'next/link';
import { ArrowRight, Crown, Dices, ShieldCheck, Sparkles, Volume2 } from 'lucide-react';
import { PageShell } from '@/components/layout/page-shell';

export const metadata = {
  title: 'Casino | BetVima',
  description: 'Explore the original BetVima casino game collection. Pharaoh Gold is available in demo mode with USD play credits.',
};
export default function CasinoLobby() {
  return <PageShell>
    <div dir="ltr" className="mx-auto max-w-[1200px] overflow-hidden rounded-[24px] bg-[#080d18] text-white shadow-[0_22px_65px_#0003]">
      <section className="relative isolate overflow-hidden border-b border-[#cfaa6b44] px-5 pb-8 pt-10 sm:px-10 sm:pb-12 sm:pt-14">
        <div className="absolute inset-0 -z-10 bg-[url('/casino/pharaoh-gold/scene.svg')] bg-cover bg-center opacity-45"/>
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-[#070d1a] via-[#070d1aed] to-[#070d1a36]"/>
        <span className="inline-flex items-center gap-2 rounded-full border border-[#c99f5e77] bg-[#362b27aa] px-4 py-2 text-[10px] font-black tracking-[.2em] text-[#f8d89d]"><Crown size={14}/> BETVIMA ORIGINAL GAMES</span>
        <h1 className="mt-5 max-w-[660px] font-[Georgia,serif] text-4xl font-bold leading-tight tracking-tight text-[#ffe5a8] sm:text-6xl">The Royal Casino</h1>
        <p className="mt-4 max-w-[540px] text-sm leading-7 text-[#e0d6c7] sm:text-base">An original collection of immersive casino games. Experience our first title, Pharaoh Gold, with a cinematic environment, procedural sound design and interactive reels.</p>
        <div className="mt-5 flex flex-wrap gap-2 text-xs font-semibold text-[#d8cebd]">
          <span className="flex items-center gap-1 rounded-lg border border-white/10 bg-black/30 px-3 py-2"><ShieldCheck size={14} className="text-[#00d47a]"/> DEMO MODE ONLY</span>
          <span className="flex items-center gap-1 rounded-lg border border-white/10 bg-black/30 px-3 py-2"><Dices size={14} className="text-[#00d47a]"/> USD · MIN $0.10</span>
          <span className="flex items-center gap-1 rounded-lg border border-white/10 bg-black/30 px-3 py-2"><Volume2 size={14} className="text-[#00d47a]"/> CUSTOM SOUND</span>
        </div>
      </section>
      <section className="px-5 py-8 sm:px-10 sm:py-12">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-extrabold tracking-[.2em] text-[#00d47a]">FEATURED · ORIGINAL RELEASE</p><h2 className="mt-1 text-2xl font-black">Featured Games</h2></div><span className="rounded-full border border-[#4e5a67] px-3 py-1.5 text-[11px] font-semibold text-[#bcc6d4]">1 playable demo</span></div>
        <div className="grid gap-5 md:grid-cols-[1.1fr_.9fr]">
          <Link href="/casino/pharaoh-gold" className="group relative flex min-h-[290px] flex-col justify-end overflow-hidden rounded-3xl border border-[#d9b57585] bg-[#1f1823] p-6 shadow-[0_22px_50px_#0006] transition duration-300 hover:-translate-y-1 hover:border-[#ffe3a9]">
            <div className="absolute inset-0 bg-[url('/casino/pharaoh-gold/scene.svg')] bg-cover bg-center transition duration-700 group-hover:scale-105"/>
            <div className="absolute inset-0 bg-gradient-to-t from-[#050913] via-[#0d0c1866] to-transparent"/>
            <div className="relative z-10 max-w-[390px]">
              <img src="/casino/pharaoh-gold/logo.svg" alt="Pharaoh Gold" className="h-36 w-[330px] max-w-full object-contain drop-shadow-lg"/>
              <p className="mt-1 text-xs leading-6 text-[#f0e6d2]">5×3 reels · 20 fixed paylines · 8/12/20 free spins · Gold and mystery</p>
              <span className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#00d47a] px-5 py-3 text-sm font-black text-[#05291a] shadow-[0_4px_24px_#00d47a55]">PLAY DEMO <ArrowRight size={17}/></span>
            </div>
          </Link>
          <div className="flex min-h-[290px] flex-col items-start justify-between rounded-3xl border border-[#304257] bg-[radial-gradient(ellipse_at_25%_20%,#214159,#101727_60%,#090e19)] p-7">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-[#547d9766] bg-[#172d41] text-[#87b0d1]"><Sparkles size={30}/></div>
            <div><span className="text-[11px] font-bold uppercase tracking-[.2em] text-[#81a8c9]">More titles in development</span><h3 className="mt-3 text-2xl font-black">Crafted, not cloned.</h3><p className="mt-3 max-w-[350px] text-sm leading-6 text-[#b5c1d0]">Additional slots, table games and instant games will appear when each title is finished and tested. No fake or unavailable games are listed as playable.</p></div>
          </div>
        </div>
        <p className="mt-7 rounded-2xl border border-[#f0c87240] bg-[#40321d44] p-4 text-xs leading-6 text-[#e0d5b9]">Pharaoh Gold currently uses demo credits only. No casino game on this page places real-money wagers, transfers funds or uses your BetVima wallet. All in-game amounts are expressed in USD with a minimum demo spin of $0.10. RNG and RTP require independent certification before real-money release.</p>
      </section>
    </div>
  </PageShell>;
}
