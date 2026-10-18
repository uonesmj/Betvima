'use client';
import { sportsbookMatchHref } from '@/lib/betsapi-links';
import { BetsApiHeadlinePrices } from '@/components/betsapi/betsapi-headline-prices';
import { useApp } from "../layout/providers";
import { CasinoHomeCarousel } from '@/components/casino/casino-showcase';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';
import {
  Sparkles,
  ChevronRight,
  Clock3,
  Dices,
  Flame,
  Radio,
  Search,
  Star,
  Trophy,
  Tv,
  Zap,
} from 'lucide-react';
import type { MatchView } from '@/components/betting/match-card';
import { formatOddsScaled } from '@/lib/i18n';
import { useBetSlip, type SlipItem } from '@/lib/store/betslip';
import { LeagueLogo, TeamLogo } from '@/components/ui/logo';
import { translateSportName, translateVisibleText, translateBettingSelection } from '@/lib/i18n/ui-phrases';

type Sport = {
  key: string;
  name: string;
  icon?: string | null;
};

const SPORT_IMAGE_FILES: Record<string, string> = {
  football: 'football.png',
  basketball: 'basketball.png',
  tennis: 'tennis.png',
  volleyball: 'volleyball.png',
  handball: 'handball.png',
  hockey: 'ice-hockey.png',
  'ice-hockey': 'ice-hockey.png',
  baseball: 'baseball.png',
  'american-football': 'american-football.png',
  cricket: 'cricket.png',
  mma: 'mma.png',
  boxing: 'boxing.png',
  'table-tennis': 'table-tennis.png',
};

function formatHomeRelative(iso: string) {
  const diff = new Date(iso).getTime() - Date.now();
  const hours = Math.round(diff / 3600000);

  if (hours >= 24) {
    const days = Math.round(hours / 24);
    return days === 1 ? 'Tomorrow' : `In ${days} days`;
  }

  if (hours > 0) return `In ${hours}h`;

  return 'Starting soon';
}

function SportIcon({ sport }: { sport: Sport }) {
  const imageFile = SPORT_IMAGE_FILES[sport.key];

  if (imageFile) {
    return (
      <img
        src={`/sports/${imageFile}`}
        alt=""
        className="h-full w-full rounded-full bg-[#07111F] object-contain p-1.5"
        loading="lazy"
        aria-hidden="true"
      />
    );
  }

  return (
    <span className="grid h-full w-full place-items-center text-[#087FF5]">
      <Trophy size={25} strokeWidth={1.5} aria-hidden="true" />
    </span>
  );
}

function SectionHeader({
  title,
  href,
  icon,
  live = false,
  count,
}: {
  title: string;
  href: string;
  icon: React.ReactNode;
  live?: boolean;
  count?: number;
}) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-1.5">
        <span className={live ? 'grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-[#F70F7F] text-white shadow-[0_5px_14px_rgba(247,15,127,.22)]' : 'grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-[#087FF5] text-white shadow-[0_5px_14px_rgba(8,127,245,.18)]'}>
          {icon}
        </span>

        <h2 className="truncate text-[15px] font-extrabold text-[#20242A] sm:text-base">
          {title}
        </h2>

        {typeof count === 'number' && count > 0 ? (
          <span className="rounded-full bg-[#EAF3FF] px-2 py-0.5 text-[9px] font-black text-[#087FF5]">
            {count}
          </span>
        ) : null}
      </div>

      <Link
        href={href}
        className="flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-[#087FF5] px-3 text-[10px] font-extrabold text-white shadow-[0_5px_14px_rgba(8,127,245,.20)] transition hover:bg-[#0672DC] active:scale-[.98]"
      >
        View all
        <ChevronRight size={13} />
      </Link>
    </div>
  );
}

function MatchCard({
  match,
  liveEnabled,
}: {
  match: MatchView;
  liveEnabled: boolean;
  liveTotal?: number | null;
  upcomingTotal?: number | null;
}) {
  const { locale } = useApp();
  const toggle = useBetSlip((s) => s.toggle);
  const items = useBetSlip((s) => s.items);

  const home = match.participants.find((p) => p.role === 'HOME');
  const away = match.participants.find((p) => p.role === 'AWAY');
  const market = match.isLive
    ? match.topMarkets?.find((item) => item.key === 'h2h')
      ?? match.topMarkets?.find((item) => item.key !== 'h2h_lay' && !item.key.startsWith('alternate_'))
      ?? match.topMarkets?.find((item) => item.key !== 'h2h_lay')
      ?? match.topMarkets?.[0]
    : match.topMarkets?.find((item) => item.key === 'h2h')
      ?? match.topMarkets?.find((item) => item.key === 'totals')
      ?? match.topMarkets?.find((item) => item.key === 'spreads')
      ?? match.topMarkets?.find((item) => item.key === 'btts')
      ?? match.topMarkets?.find((item) => item.key !== 'h2h_lay')
      ?? match.topMarkets?.[0];

  const marketLabel =
    market?.key === 'h2h' && /football|soccer/i.test(match.sportKey)
      ? 'Full Time Result'
      : market?.name ?? '';

  const lockedMatch =
    !match.isBettingAvailable ||
    (match.isLive && !liveEnabled);

  return (
    <article className="home-reference-card w-[60vw] min-w-[60vw] max-w-[60vw] shrink-0 snap-start overflow-hidden rounded-[14px] border border-[#DDE1E6] bg-white shadow-[0_3px_12px_rgba(0,0,0,.055)] sm:w-[60vw] sm:min-w-[60vw] sm:max-w-[60vw] md:w-[60vw] md:min-w-[60vw] md:max-w-[60vw]">
      {/* League / live status */}
      <div className="border-b border-[#E5E7EB] px-3 py-2.5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <LeagueLogo
              url={match.leagueLogoUrl}
              name={match.leagueName}
              sportKey={match.sportKey}
              size={36}
            />

            <div className="min-w-0">
              <div className="truncate text-[12px] font-extrabold leading-4 text-[#20242A]">
                {locale === 'fa' ? translateSportName(match.leagueName ?? match.sportKey) : match.leagueName ?? match.sportKey}
              </div>
              <div className="mt-0.5 truncate text-[10px] font-semibold text-[#8A9199]">
                {match.countryCode ?? 'International'} · {match.sportKey}
              </div>
            </div>
          </div>

          <div className="flex shrink-0 flex-col items-end gap-1">
            {match.isLive ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FFF0F2] px-2.5 py-1 text-[10px] font-black text-[#F04A63]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#F04A63]" />
                {match.minute == null ? 'LIVE' : `LIVE ${match.minute}′`}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-[#F3F6FA] px-2.5 py-1 text-[10px] font-extrabold text-[#59636E]">
                <Clock3 size={12} />
                {new Date(match.scheduledAt).toLocaleTimeString('en-GB', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            )}

            <div className="flex items-center gap-2 text-[9px] font-bold text-[#7E8791]">
              <span>
                {match.isLive
                  ? (/football|soccer/i.test(match.sportKey)
                      ? (match.minute != null && match.minute > 45 ? '2nd Half' : '1st Half')
                      : 'IN PLAY')
                  : 'MATCH TIME'}
              </span>
              <Star
                size={15}
                strokeWidth={1.7}
                className="text-[#A0A6AD]"
                aria-hidden="true"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Teams / score */}
      <Link
        href={sportsbookMatchHref(match.id)}
        className="block px-3 py-3 transition hover:bg-[#FAFBFC]"
      >
        <div className="mb-2 flex items-center justify-between text-[9px] font-black uppercase tracking-[.08em] text-[#8A9199]">
          <span>{match.isLive ? 'LIVE NOW' : 'UPCOMING'}</span>
          <span className="flex items-center gap-1.5">
            {match.isLive ? (
              <>
                <Tv size={12} />
                LIVE
              </>
            ) : (
              <>
                <Clock3 size={12} />
                MATCH
              </>
            )}
          </span>
        </div>

        <div className="grid grid-cols-[minmax(0,1fr)_96px_minmax(0,1fr)] items-center gap-2">
          <div className="min-w-0 text-center">
            <div className="flex justify-center">
              <TeamLogo url={home?.logoUrl} name={home?.name} size={58} variant="circle" />
            </div>
            <div className="mt-2 line-clamp-2 text-[12px] font-extrabold leading-4 text-[#20242A]">
              {locale === 'fa' ? translateSportName(home?.name ?? 'TBD') : home?.name ?? 'TBD'}
            </div>
          </div>

          <div className="flex flex-col items-center justify-center">
            <div className="flex items-center justify-center whitespace-nowrap tabular-nums text-[27px] font-black leading-none text-[#15191E]">
              <span>{match.homeScore ?? '-'}</span>
              <span className="mx-2 text-[17px] font-bold text-[#A0A6AD]">:</span>
              <span>{match.awayScore ?? '-'}</span>
            </div>

            {match.isLive ? (
              <span className="mt-2 rounded-full bg-[#FFF0F2] px-2 py-0.5 text-[9px] font-black text-[#F04A63]">
                {/football|soccer/i.test(match.sportKey)
                  ? (match.minute != null && match.minute > 45 ? '2nd Half' : '1st Half')
                  : 'IN PLAY'}
              </span>
            ) : (
              <span className="mt-2 text-[9px] font-bold text-[#9299A1]">
                {new Date(match.scheduledAt).toLocaleTimeString('en-GB', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            )}
          </div>

          <div className="min-w-0 text-center">
            <div className="flex justify-center">
              <TeamLogo url={away?.logoUrl} name={away?.name} size={58} variant="circle" />
            </div>
            <div className="mt-2 line-clamp-2 text-[12px] font-extrabold leading-4 text-[#20242A]">
              {locale === 'fa' ? translateSportName(away?.name ?? 'TBD') : away?.name ?? 'TBD'}
            </div>
          </div>
        </div>
      </Link>

      {/* Odds */}
      {match.id.startsWith('betsapi:') ? (
        <BetsApiHeadlinePrices matchId={match.id} variant="home" />
      ) : market ? (
        <div className="border-t border-[#E5E7EB] bg-[#F5F6F8] p-1.5">
          <div className="mb-1 flex items-center justify-between gap-1">
            <span className="truncate text-[7px] font-extrabold uppercase tracking-wide text-[#69717A]">
              {locale === 'fa' ? translateVisibleText(marketLabel) : marketLabel}
            </span>

            <span className="shrink-0 text-[7px] font-semibold text-[#8A9199]">
              {match.marketsCount ?? market.selections.length} markets
            </span>
          </div>

          <div className="grid grid-cols-3 gap-0.5">
            {market.selections.slice(0, 3).map((selection) => {
              const locked =
                lockedMatch ||
                market.status !== 'open' ||
                selection.status !== 'open';

              const selected = items.some(
                (item) => item.selectionId === selection.id,
              );

              const item: SlipItem = {
                selectionId: selection.id,
                marketId: market.id,
                matchId: match.id,
                label: selection.name,
                marketLabel,
                matchLabel:
                  `${home?.name ?? ''} - ${away?.name ?? ''}`.trim(),
                sportSlug: match.sportKey,
                oddsScaled: selection.oddsScaled,
                oddsVersionSeen: selection.oddsVersion,
                addedAt: Date.now(),
              };

              return (
                <button
                  key={selection.id}
                  type="button"
                  disabled={locked}
                  aria-pressed={selected}
                  data-selected={selected}
                  onClick={() => toggle(item)}
                  className={`min-h-[42px] rounded-[7px] border px-1 py-1 text-center transition ${
                    selected
                      ? 'border-[#08B86A] bg-[#EAF9F1]'
                      : 'border-[#DEE2E6] bg-white hover:border-[#087FF5]/50 hover:bg-[#F8FAFC]'
                  } disabled:cursor-not-allowed disabled:opacity-45`}
                >
                  <span
                    className={`block truncate text-[7px] font-semibold ${
                      selected
                        ? 'text-[#078653]'
                        : 'text-[#747C85]'
                    }`}
                  >
                    {locale === 'fa' ? translateBettingSelection(selection.name) : selection.name}
                  </span>

                  <strong
                    className={`mt-0.5 block text-[10px] font-black tabular-nums ${
                      selected
                        ? 'text-[#078653]'
                        : selection.movement === 'UP'
                          ? 'text-[#08A965]'
                          : selection.movement === 'DOWN'
                            ? 'text-[#E64961]'
                            : 'text-[#20242A]'
                    }`}
                  >
                    {formatOddsScaled(selection.oddsScaled)}
                  </strong>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="border-t border-[#E5E7EB] bg-[#F7F8F9] px-3.5 py-3 text-[9px] font-semibold text-[#8A9199]">
          Odds currently unavailable
        </div>
      )}
    </article>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-[#DDE1E6] bg-white px-5 py-9 text-center shadow-[0_2px_10px_rgba(0,0,0,.03)]">
      <div className="mx-auto mb-2 grid h-8 w-8 place-items-center rounded-full bg-[#EEF0F3] text-[#8B929A]">
        <Zap size={18} />
      </div>

      <div className="text-xs font-bold text-[#4D555E]">
        {text}
      </div>

      <div className="mt-1 text-[9px] text-[#9299A1]">
        Check back shortly for new events.
      </div>
    </div>
  );
}

const SPORT_ITEMS = [
  { key: "top", name: "Top", count: "1224", href: "/", icon: "top" },
  { key: "football", name: "Football", count: "1224", href: "/sports/football", icon: "football" },
  { key: "tennis", name: "Tennis", count: "259", href: "/sports/tennis", icon: "tennis" },
  { key: "basketball", name: "Basketball", count: "140", href: "/sports/basketball", icon: "basketball" },
  { key: "hockey", name: "Ice Hockey", count: "144", href: "/sports/hockey", icon: "hockey" },
  { key: "volleyball", name: "Volleyball", count: "98", href: "/sports/volleyball", icon: "volleyball" },
  { key: "baseball", name: "Baseball", count: "76", href: "/sports/baseball", icon: "baseball" },
  { key: "cricket", name: "Cricket", count: "68", href: "/sports/cricket", icon: "cricket" },
] as const;

function SportSelectorIcon({ type }: { type: string }) {
  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  if (type === "top") return (
    <svg viewBox="0 0 32 32" className="h-7 w-7" aria-hidden>
      <path {...common} d="M16 3.5c1.7 3.4 1.7 6.1.5 8.4 3.1-1.1 5.7.4 6.4 3.3.8 3.2-.9 6.8-4.1 8.5-3.9 2.1-8.8.4-10.4-3.6-1.2-3.1.2-6.4 2.9-8.2-.1 2.2.5 3.6 1.8 4.4.5-4.1 1.5-7.6 2.9-12.8Z"/>
      <path {...common} d="M12.8 24.4c1.4 1 3.7 1.1 5.3-.1"/>
    </svg>
  );

  if (type === "football") return (
    <svg viewBox="0 0 32 32" className="h-7 w-7" aria-hidden>
      <path {...common} d="m16 4 8.8 6.4-3.4 10.4h-10.8L7.2 10.4 16 4Z"/>
      <path {...common} d="m16 4 2.8 7.7m6-1.3-6 1.3m2.6 9.1-5.4-4.2m-5.4 4.2 5.4-4.2m-8.8-5.8 6 1.3"/>
    </svg>
  );

  if (type === "tennis") return (
    <svg viewBox="0 0 32 32" className="h-7 w-7" aria-hidden>
      <circle {...common} cx="16" cy="16" r="11"/>
      <path {...common} d="M8.2 8.2c4.1 1.4 6.3 4.1 6.5 7.1.2 3.2-1.5 6.1-4.9 8.4m14-15.1c-4.1-1.4-6.3-4.1-6.5-7.1-.2-3.2 1.5-6.1 4.9-8.4" transform="rotate(45 16 16)"/>
    </svg>
  );

  if (type === "basketball") return (
    <svg viewBox="0 0 32 32" className="h-7 w-7" aria-hidden>
      <circle {...common} cx="16" cy="16" r="11"/>
      <path {...common} d="M5.2 16h21.6M16 5.2c3.1 3.1 4.7 6.7 4.7 10.8S19.1 23.7 16 26.8M16 5.2c-3.1 3.1-4.7 6.7-4.7 10.8S12.9 23.7 16 26.8"/>
    </svg>
  );

  if (type === "hockey") return (
    <svg viewBox="0 0 32 32" className="h-7 w-7" aria-hidden>
      <path {...common} d="m8 7 9 18"/>
      <path {...common} d="M17 25h8"/>
      <path {...common} d="M7 7h5"/>
      <path {...common} d="M6 25h12"/>
      <circle {...common} cx="7" cy="25" r="1.7"/>
    </svg>
  );

  if (type === "volleyball") return (
    <svg viewBox="0 0 32 32" className="h-7 w-7" aria-hidden>
      <circle {...common} cx="16" cy="16" r="11"/>
      <path {...common} d="M16 5c2.2 3.4 2.6 6.7 1.2 9.7-1.4 3-4.3 4.8-8.4 5.2m18.2-7.8c-4-.2-7.1 1-9 3.7-1.8 2.7-1.9 6-.2 9.7m-13-13.1c3.1-1.7 6.1-1.9 8.8-.5 2.8 1.4 4.4 4 4.9 7.8"/>
    </svg>
  );

  if (type === "baseball") return (
    <svg viewBox="0 0 32 32" className="h-7 w-7" aria-hidden>
      <circle {...common} cx="16" cy="16" r="11"/>
      <path {...common} d="M10.3 8.1c2.5 2.1 3.5 4.5 3 7.1-.4 2.5-1.9 4.7-4.5 6.5m12.9-13.6c-2.5 2.1-3.5 4.5-3 7.1.4 2.5 1.9 4.7 4.5 6.5"/>
    </svg>
  );

  return (
    <svg viewBox="0 0 32 32" className="h-7 w-7" aria-hidden>
      <circle {...common} cx="16" cy="16" r="11"/>
      <path {...common} d="M7 12.5c4.7-.5 8.5.8 11.3 3.8 2.1 2.2 3.4 4.8 3.7 7.6M9.2 23.8c3.7-2.5 6.1-5.4 7.1-8.8.8-2.8.7-5.5-.2-8.2"/>
    </svg>
  );
}

function SportStrip() {
  const pathname = usePathname();
  const scrollerRef = useRef<HTMLDivElement>(null);
  const drag = useRef({ active: false, startX: 0, startScroll: 0 });
  const activeKey = pathname === "/" ? "top" : SPORT_ITEMS.find((item) => pathname === item.href)?.key ?? "top";
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    if (activeKey === "top") {
      el.scrollTo({ left: 0, behavior: "smooth" });
      return;
    }
    const active = el.querySelector(`[data-sport-key="${activeKey}"]`) as HTMLElement | null;
    active?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [activeKey]);

  const restoreScroll = () => {
    const el = scrollerRef.current;
    if (!el) return;
    const saved = Number(sessionStorage.getItem("bet66-sports-scroll") || "0");
    if (Number.isFinite(saved)) el.scrollLeft = saved;
  };

  const saveScroll = () => {
    const el = scrollerRef.current;
    if (el) sessionStorage.setItem("bet66-sports-scroll", String(el.scrollLeft));
  };

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    const el = scrollerRef.current;
    if (!el) return;
    drag.current = { active: true, startX: event.clientX, startScroll: el.scrollLeft };
    el.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const el = scrollerRef.current;
    if (!el || !drag.current.active) return;
    el.scrollLeft = drag.current.startScroll - (event.clientX - drag.current.startX);
  };

  const stopDrag = () => {
    drag.current.active = false;
    saveScroll();
  };

  return (
    <section className="mb-6">
      <div
        ref={scrollerRef} data-bet66-sports-strip
        className="w-full overflow-x-auto overflow-y-hidden overscroll-x-contain touch-pan-x select-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{ WebkitOverflowScrolling: "touch", cursor: "grab" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={stopDrag}
        onPointerCancel={stopDrag}
        onPointerLeave={stopDrag}
        onScroll={saveScroll}
        onTouchStart={(event) => {
          const el = scrollerRef.current;
          if (el) drag.current = { active: true, startX: event.touches[0]?.clientX ?? 0, startScroll: el.scrollLeft };
        }}
        onTouchMove={(event) => {
          const el = scrollerRef.current;
          if (el && drag.current.active) {
            el.scrollLeft = drag.current.startScroll - ((event.touches[0]?.clientX ?? 0) - drag.current.startX);
          }
        }}
        onTouchEnd={stopDrag}
      >
        <div className="flex w-max min-w-max items-center gap-2 px-1 py-1">
          {SPORT_ITEMS.map((item) => (
            <Link
              key={item.key}
              href={item.href}
              draggable={false}
              data-sport-key={item.key}
              onClick={() => sessionStorage.setItem("bet66-sports-scroll", String(scrollerRef.current?.scrollLeft ?? 0))}
              className={`group flex h-[58px] w-[104px] shrink-0 items-center gap-2.5 rounded-[14px] border px-3 transition-all duration-200 ${
                ((item.key === "top" && pathname === "/") || (item.key !== "top" && pathname === item.href))
                  ? "border-[#087FF5] bg-[#087FF5] text-white shadow-[0_5px_16px_rgba(8,127,245,.20)]"
                  : "border-[#E1E5EA] bg-white text-[#252A31] hover:border-[#C9D1DA] hover:shadow-[0_4px_12px_rgba(20,30,40,.08)]"
              }`}
            >
              <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                ((item.key === "top" && pathname === "/") || (item.key !== "top" && pathname === item.href)) ? "bg-white/15" : "bg-[#F2F4F7]"
              }`}>
                <SportSelectorIcon type={item.icon} />
              </span>
              <span className="min-w-0 flex-1 text-left">
                <span className="block text-[9px] font-extrabold leading-3 tracking-tight break-words">{item.name}</span>
                <span className={`block text-[9px] leading-4 ${((item.key === "top" && pathname === "/") || (item.key !== "top" && pathname === item.href)) ? "text-white/70" : "text-[#9299A2]"}`}>{item.count}</span>
              </span>
            </Link>
          ))}
        </div>
        <div className="mx-1 mt-1 h-1 overflow-hidden rounded-full bg-[#E3E7EC]">
          <div className="h-full w-[27%] rounded-full bg-[#18263D]" />
        </div>
      </div>
    </section>
  );
}

export function HomeReference({  sports,
  live,
  upcoming,
  topBets,
  topBetsUnavailable = false,
  liveEnabled,
  liveTotal,
  upcomingTotal,
}: {
  sports: Sport[];
  live: MatchView[];
  upcoming: MatchView[];
  topBets: MatchView[];
  topBetsUnavailable?: boolean;
  liveEnabled: boolean;
  liveTotal?: number | null;
  upcomingTotal?: number | null;
}) {

  const footballUpcoming = upcoming.filter(
    (match) =>
      !match.sportKey.toLowerCase().includes('esport'),
  );

  // The backend selects fresh, open odds before ranking; guard again on render.
  const featuredBets = topBets.filter((match) =>
    !match.isLive &&
    match.isBettingAvailable &&
    !match.sportKey.toLowerCase().includes('esport') &&
    (match.topMarkets ?? []).some((market) =>
      market.status === 'open' &&
      market.selections.some((selection) => selection.status === 'open'),
    ),
  ).slice(0, 6);

  const topBetIds = new Set(
    featuredBets.map((match) => match.id),
  );

  const upcomingOnly = footballUpcoming.filter(
    (match) => !topBetIds.has(match.id),
  );

  return (
    <div className="w-full pb-0">


      {/* Live */}
      <section className="mb-6">
        <SectionHeader
          title="Live now"
          href="/live"
          icon={<Radio size={17} />}
          live
          count={liveTotal ?? live.length}
        />

        {live.length > 0 ? (
          <div className="flex snap-x snap-mandatory gap-2.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden xl:grid xl:grid-cols-3 xl:overflow-visible xl:gap-3">
            {live.map((match) => (
              <MatchCard
                key={match.id}
                match={match}
                liveEnabled={liveEnabled}
              />
            ))}
          </div>
        ) : (
          <EmptyState text="No live events right now." />
        )}
      </section>

      {/* Top Bets: only vetted selections can appear here. */}
      {featuredBets.length > 0 && <section className="mb-6">
        <SectionHeader
          title="Top Bets"
          href="/topbets"
          icon={<Flame size={17} />}
          count={featuredBets.length}
        />

        {featuredBets.length > 0 ? (
          <div className="flex snap-x snap-mandatory gap-2.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden xl:grid xl:grid-cols-3 xl:overflow-visible xl:gap-3">
            {featuredBets.map((match) => (
              <MatchCard
                key={match.id}
                match={match}
                liveEnabled={liveEnabled}
              />
            ))}
          </div>
        ) : (
          <EmptyState text={topBetsUnavailable ? "Top bets are temporarily unavailable." : "No upcoming matches with active odds right now."} />
        )}
      </section>}

      {/* Upcoming */}
      <section className="mb-6">
        <SectionHeader
          title="Upcoming"
          href="/sports/football"
          icon={<Clock3 size={17} />}
          count={upcomingTotal ?? upcomingOnly.length}
        />

        {upcomingOnly.length > 0 ? (
          <div className="flex snap-x snap-mandatory gap-2.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden xl:grid xl:grid-cols-3 xl:overflow-visible xl:gap-3">
            {upcomingOnly.map((match) => (
              <MatchCard
                key={match.id}
                match={match}
                liveEnabled={liveEnabled}
              />
            ))}
          </div>
        ) : (
          <EmptyState text="No data available." />
        )}
      </section>

      {/* Casino: follows Upcoming and uses the exact shared sports section header. */}
      <section className="mb-6">
        <SectionHeader
          title="Casino"
          href="/casino"
          icon={<Dices size={17} />}
        />
        <CasinoHomeCarousel />
      </section>

      </div>
  );
}
