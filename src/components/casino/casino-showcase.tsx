'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ChevronRight, Dices, Gamepad2, Loader2, Play, Search } from 'lucide-react';
import { useApp } from '@/components/layout/providers';
import { casinoGameGroup } from '@/lib/casino-featured';

export type CasinoListing = {
  id: string;
  name: string;
  category: string;
  provider: string;
  providerName: string;
  image: string | null;
  demoSupported: boolean;
};

type CataloguePayload = {
  ok: boolean;
  data?: { items: CasinoListing[]; total: number };
};

function safeGameImage(src: string | null): string | null {
  if (!src) return null;
  if (src.startsWith('/') && !src.startsWith('//')) return src;
  try {
    const url = new URL(src);
    return url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}

export function CasinoGameCard({
  game, compact = false, onPlay, launching = false, locked = false,
}: {
  game: CasinoListing;
  compact?: boolean;
  onPlay?: (game: CasinoListing) => void;
  launching?: boolean;
  locked?: boolean;
}) {
  const { locale } = useApp();
  const [imageFailed, setImageFailed] = useState(false);
  const group = casinoGameGroup({ game_type: game.category });
  const groupLabel = group === 'live' ? 'Live Casino' : group === 'slots' ? 'Slots' : game.category;
  const image = imageFailed ? null : safeGameImage(game.image);
  const href = '/casino?q=' + encodeURIComponent(game.name);
  const label = (en: string, fa: string) => locale === 'fa' ? fa : en;

  return (
    <article className={'home-reference-card min-w-0 shrink-0 snap-start overflow-hidden rounded-[14px] border border-[#DDE1E6] bg-white shadow-[0_3px_12px_rgba(0,0,0,.055)] ' +
      (compact ? 'w-[60vw] min-w-[60vw] max-w-[60vw] sm:w-[60vw] sm:min-w-[60vw] sm:max-w-[60vw] xl:w-auto xl:min-w-0 xl:max-w-none' : 'w-full')}>
      {compact ? (
        <div className="relative flex h-[238px] items-center justify-center overflow-hidden bg-[#F0F3F7] sm:h-[260px]">
          {image ? (
            <img src={image} alt={game.name} loading="lazy" onError={() => setImageFailed(true)}
              className="h-full w-full object-cover transition-transform duration-300 hover:scale-[1.04]" />
          ) : (
            <Gamepad2 size={44} className="text-[#B2BEC9]" aria-hidden="true" />
          )}
          <span className={'absolute left-3 top-3 rounded-lg px-2.5 py-1.5 text-[10px] font-extrabold ' +
            (group === 'live' ? 'bg-[#FFF0F2] text-[#D83A59]' : 'bg-[#EAF9F1] text-[#078653]')}>
            {group === 'live' ? 'LIVE' : group === 'slots' ? 'SLOTS' : 'GAME'}
          </span>
          <span className="absolute right-3 top-3 inline-flex max-w-[60%] items-center gap-1.5 rounded-lg bg-[#202832]/90 px-2.5 py-1.5 text-[10px] font-bold text-white">
            <Dices size={13} className="shrink-0" aria-hidden="true" />
            <span className="truncate">{groupLabel}</span>
          </span>
        </div>
      ) : (
        <>
        <div className="flex items-center justify-between gap-2 border-b border-[#E5E7EB] px-3 py-2.5">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[11px] border border-[#E1E5EA] bg-[#F7F9FA] text-[#087FF5]">
              <Dices size={20} aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[12px] font-extrabold text-[#20242A]">{game.providerName || game.provider}</span>
              <span className="mt-0.5 block truncate text-[10px] font-semibold text-[#8A9199]">{groupLabel}</span>
            </span>
          </div>
          <span className={'shrink-0 rounded-full px-2 py-1 text-[9px] font-extrabold ' +
            (group === 'live' ? 'bg-[#FFF0F2] text-[#D83A59]' : 'bg-[#EAF9F1] text-[#078653]')}>
            {group === 'live' ? 'LIVE' : group === 'slots' ? 'SLOTS' : 'GAME'}
          </span>
        </div>
        <div className="relative flex h-[125px] items-center justify-center overflow-hidden bg-[#F0F3F7] sm:h-[155px]">
          {image ? (
            <img src={image} alt={game.name} loading="lazy" onError={() => setImageFailed(true)}
              className="h-full w-full object-cover transition-transform duration-300 hover:scale-[1.04]" />
          ) : (
            <Gamepad2 size={38} className="text-[#B2BEC9]" aria-hidden="true" />
          )}
        </div>
        </>
      )}
      <div className="border-t border-[#E5E7EB] bg-white px-3 py-2.5">
        <p className="truncate text-[12px] font-extrabold text-[#20242A]" title={game.name}>{game.name}</p>
        <p className="mt-0.5 truncate text-[10px] font-semibold text-[#8A9199]">{groupLabel} · {game.providerName || game.provider}</p>
        {onPlay && locked ? (
          <Link href="/account/kyc" className="mt-2 flex h-9 items-center justify-center rounded-[9px] bg-[#087FF5] text-[11px] font-extrabold text-white">
            {label('Verify identity to play', 'احراز هویت برای بازی')}
          </Link>
        ) : onPlay ? (
          <button type="button" disabled={launching} onClick={() => onPlay(game)}
            className="mt-2 flex h-9 w-full items-center justify-center gap-2 rounded-[9px] bg-[#087FF5] text-[11px] font-extrabold text-white transition hover:bg-[#0672DC] disabled:opacity-60">
            {launching ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
            {label('Play demo', 'اجرای دمو')}
          </button>
        ) : (
          <Link href={href} className="mt-2 flex h-9 items-center justify-center gap-2 rounded-[9px] bg-[#087FF5] text-[11px] font-extrabold text-white transition hover:bg-[#0672DC]">
            {label('View game', 'مشاهده بازی')} <ChevronRight size={14} />
          </Link>
        )}
      </div>
    </article>
  );
}

/** Embedded under Upcoming; same horizontal scroll, snap, width and card shell as sports. */
export function CasinoHomeCarousel() {
  const { locale } = useApp();
  const [games, setGames] = useState<CasinoListing[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/v1/casino/games?featured=1&limit=8', {
      credentials: 'same-origin', cache: 'no-store', signal: controller.signal,
    })
      .then(async (response) => response.ok ? response.json() as Promise<CataloguePayload> : null)
      .then((payload) => {
        if (!controller.signal.aborted) setGames(payload?.data?.items ?? []);
      })
      .catch(() => { if (!controller.signal.aborted) setGames([]); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, []);

  if (loading) {
    return (
      <div className="flex gap-2.5 overflow-hidden" aria-label="Loading casino games" aria-busy="true">
        {[0, 1].map((n) => <div key={n} className="h-[245px] w-[60vw] shrink-0 animate-pulse rounded-[14px] border border-[#DDE1E6] bg-white" />)}
      </div>
    );
  }
  if (!games.length) {
    return (
      <div className="rounded-2xl border border-[#DDE1E6] bg-white px-5 py-7 text-center text-xs font-semibold text-[#69717A]">
        {locale === 'fa' ? 'بازی‌های کازینو فعلاً در دسترس نیستند.' : 'Casino games are temporarily unavailable.'}
      </div>
    );
  }
  return (
    <div aria-label="Casino games" dir="ltr"
      className="flex snap-x snap-mandatory gap-2.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden xl:grid xl:grid-cols-3 xl:overflow-visible xl:gap-3">
      {games.map((game) => <CasinoGameCard key={game.id} game={game} compact />)}
    </div>
  );
}

export function CasinoCatalogueClient() {
  const { locale, session, sessionLoading } = useApp();
  const label = (en: string, fa: string) => locale === 'fa' ? fa : en;
  const [group, setGroup] = useState<'all' | 'slots' | 'live'>('all');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [games, setGames] = useState<CasinoListing[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [launchingId, setLaunchingId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [identityAccess, setIdentityAccess] = useState(false);
  const [identityChecked, setIdentityChecked] = useState(false);
  useEffect(() => {
    if (!session?.authenticated) { setIdentityAccess(false); setIdentityChecked(true); return; }
    const controller = new AbortController();
    setIdentityChecked(false);
    fetch('/api/v1/account/kyc', { credentials: 'same-origin', cache: 'no-store', signal: controller.signal })
      .then(async (res) => res.ok ? res.json() as Promise<{ data?: { gameAccessApproved?: boolean } }> : null)
      .then((body) => { if (!controller.signal.aborted) setIdentityAccess(body?.data?.gameAccessApproved === true); })
      .catch(() => { if (!controller.signal.aborted) setIdentityAccess(false); })
      .finally(() => { if (!controller.signal.aborted) setIdentityChecked(true); });
    return () => controller.abort();
  }, [session?.authenticated, session?.user?.id]);

  useEffect(() => {
    const initialQuery = new URLSearchParams(window.location.search).get('q');
    if (initialQuery) setQuery(initialQuery.slice(0, 80));
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: '40' });
    if (group !== 'all') params.set('group', group);
    if (query.trim()) params.set('q', query.trim().slice(0, 80));
    fetch('/api/v1/casino/games?' + params, {
      cache: 'no-store', credentials: 'same-origin', signal: controller.signal,
    })
      .then(async (response) => response.ok ? response.json() as Promise<CataloguePayload> : null)
      .then((payload) => {
        if (controller.signal.aborted) return;
        const items = payload?.data?.items ?? [];
        setGames((existing) => page === 1 ? items : [...existing, ...items.filter((item) => !existing.some((old) => old.id === item.id))]);
        setTotal(payload?.data?.total ?? 0);
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setGames([]); setTotal(0);
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [group, query, page]);

  const playDemo = async (game: CasinoListing) => {
    if (!sessionLoading && !session?.authenticated) {
      window.dispatchEvent(new CustomEvent('nova:open-auth-sheet', { detail: { mode: 'login' } }));
      setMessage(label('Sign in to launch a demo game.', 'برای اجرای بازی دمو وارد حساب شوید.'));
      return;
    }
    if (sessionLoading || launchingId) return;
    if (!identityAccess) {
      setMessage(label('Identity approval is required to play.', 'برای بازی باید احراز هویت شما تأیید شود.'));
      return;
    }
    setLaunchingId(game.id); setMessage('');
    try {
      const response = await fetch('/api/v1/casino/demo', {
        method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameId: game.id, device: /Mobi|Android/i.test(navigator.userAgent) ? 'mobile' : 'desktop', lang: locale }),
      });
      const payload: { data?: { url?: string }; error?: string } = await response.json();
      const url = payload.data?.url;
      if (!response.ok || !url || !url.startsWith('https://')) {
        setMessage(response.status === 401
          ? label('Sign in first to play.', 'ابتدا وارد حساب شوید.')
          : label('Demo unavailable for this game. Try another title.', 'دموی این بازی در دسترس نیست. بازی دیگری انتخاب کنید.'));
        return;
      }
      window.location.assign(url);
    } catch {
      setMessage(label('Could not launch this demo. Try again.', 'اجرای دمو ممکن نشد. دوباره تلاش کنید.'));
    } finally {
      setLaunchingId(null);
    }
  };

  return (
    <div dir="ltr" className="space-y-4">
      <div className="flex flex-col gap-3 rounded-2xl border border-[#DDE1E6] bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
        <div role="group" aria-label="Casino game categories" className="flex gap-1.5">
          {(['all', 'slots', 'live'] as const).map((type) => (
            <button key={type} type="button" aria-pressed={group === type}
              onClick={() => { setGroup(type); setPage(1); setGames([]); }}
              className={'rounded-lg px-3 py-2 text-[11px] font-bold transition ' +
                (group === type ? 'bg-[#087FF5] text-white' : 'bg-[#F2F4F7] text-[#59636E] hover:bg-[#E8EFF8]')}>
              {type === 'all' ? label('All games', 'همه بازی‌ها') : type === 'slots' ? label('Slots', 'اسلات') : label('Live Casino', 'کازینو زنده')}
            </button>
          ))}
        </div>
        <label className="flex h-10 items-center gap-2 rounded-xl border border-[#DDE1E6] bg-[#F8FAFC] px-3 text-[#8A9199] sm:w-[280px]">
          <Search size={17} aria-hidden="true" />
          <input className="w-full bg-transparent text-[12px] text-[#20242A] outline-none placeholder:text-[#9BA3AC]"
            value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); setGames([]); }}
            placeholder={label('Search games', 'جستجوی بازی‌ها')} aria-label={label('Search games', 'جستجوی بازی‌ها')} maxLength={80} />
        </label>
      </div>
      {session?.authenticated && identityChecked && !identityAccess ? (
        <div role="status" className="rounded-2xl border border-[#BCD8F6] bg-[#EFF7FF] px-4 py-4 text-xs font-semibold text-[#234A72]">
          <p>{label('Games are visible, but play is locked until your identity and legal age have been approved by an operator.', 'بازی‌ها قابل مشاهده هستند، اما اجرای بازی تا تأیید هویت و سن قانونی شما توسط مدیر قفل است.')}</p>
          <Link href="/account/kyc" className="mt-2 inline-block font-black text-[#087FF5] underline">{label('Upload identity documents', 'ارسال مدارک احراز هویت')}</Link>
        </div>
      ) : null}
      {message ? <p role="status" className="rounded-xl bg-[#FFF5ED] px-4 py-3 text-xs font-semibold text-[#9A4E14]">{message}</p> : null}
      {games.length ? (
        <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3 xl:grid-cols-4">
          {games.map((game) => <CasinoGameCard key={game.id} game={game} onPlay={playDemo} launching={launchingId === game.id} locked={!identityAccess || !identityChecked} />)}
        </div>
      ) : !loading ? (
        <div className="rounded-2xl border border-[#DDE1E6] bg-white px-5 py-10 text-center text-sm font-semibold text-[#69717A]">
          {label('No games currently available in this category.', 'در این دسته فعلاً بازی در دسترس نیست.')}
        </div>
      ) : null}
      {loading ? <div role="status" className="flex items-center justify-center gap-2 py-5 text-xs text-[#69717A]"><Loader2 size={17} className="animate-spin" />{label('Loading games...', 'در حال بارگذاری بازی‌ها...')}</div> : null}
      {!loading && games.length < total ? (
        <button type="button" onClick={() => setPage((current) => current + 1)}
          className="mx-auto block rounded-xl bg-[#087FF5] px-5 py-2.5 text-xs font-extrabold text-white hover:bg-[#0672DC]">
          {label('Load more games', 'نمایش بازی‌های بیشتر')}
        </button>
      ) : null}
    </div>
  );
}
