'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, CheckCheck, ChevronRight, X } from 'lucide-react';
import { useApp } from '@/components/layout/providers';
import { apiRequest } from '@/lib/hooks/useApi';

type InboxNotification = {
  id: string; title: string; body: string; eventKey: string;
  createdAt: string; readAt: string | null;
  data: Record<string, unknown> | null;
};
type Inbox = {
  items: InboxNotification[]; total: number; unreadCount: number;
  hasMore: boolean; page: number;
};
type Tab = 'all' | 'personal' | 'general';

function categoryOf(item: InboxNotification): 'personal' | 'general' {
  return item.data?.audience === 'general' ? 'general' : 'personal';
}
function actionFor(item: InboxNotification): { label: string; href: string } | null {
  const label = item.data?.ctaLabel;
  const href = item.data?.ctaHref;
  if (typeof label !== 'string' || typeof href !== 'string') return null;
  // Reject scheme-relative, backslash, or cross-origin redirects.
  if (!/^\/(?!\/)[a-zA-Z0-9/_?=&.%#-]*$/.test(href) || href.includes('\\')) return null;
  return { label, href };
}
function readableDate(value: string, locale: string): string {
  const time = new Date(value);
  return Number.isNaN(time.getTime()) ? '' :
    new Intl.DateTimeFormat(locale === 'fa' ? 'fa-IR' : 'en-GB', {
      day: '2-digit', month: '2-digit', year: 'numeric',
    }).format(time);
}

export function NotificationsBell() {
  const { session, locale, sessionLoading } = useApp();
  const authenticated = Boolean(session?.authenticated);
  const fa = locale === 'fa';
  const copy = (en: string, persian: string) => fa ? persian : en;
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>('all');
  const [inbox, setInbox] = useState<Inbox | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const dialogRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async (silent = false) => {
    if (!authenticated) { setInbox(null); return; }
    if (!silent) setLoading(true);
    try {
      const result = await apiRequest<Inbox>('/api/v1/notifications?page=1&pageSize=50');
      setInbox(result);
      setError('');
    } catch {
      if (!silent) setError(fa ? 'اعلان‌ها موقتاً در دسترس نیستند.' : 'Notifications are temporarily unavailable.');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [authenticated, fa]);

  useEffect(() => {
    if (!authenticated) { setInbox(null); setOpen(false); return; }
    void load(true);
    const interval = window.setInterval(() => { void load(true); }, 30000);
    const onFocus = () => { void load(true); };
    window.addEventListener('focus', onFocus);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
  }, [authenticated, load]);

  useEffect(() => {
    if (!open) return;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
      if (event.key === 'Tab' && dialogRef.current) {
        const elements = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not(:disabled),a[href],input:not(:disabled)'
        ));
        if (!elements.length) return;
        const first = elements[0]!, last = elements[elements.length - 1]!;
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault(); last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault(); first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    const focus = window.setTimeout(() => dialogRef.current?.querySelector<HTMLButtonElement>('[data-notification-close]')?.focus(), 0);
    return () => {
      document.body.style.overflow = oldOverflow;
      document.removeEventListener('keydown', onKey);
      window.clearTimeout(focus);
    };
  }, [open]);

  const mark = async (ids: string[] | 'all') => {
    if (!authenticated) return;
    try {
      await apiRequest('/api/v1/notifications', { method: 'POST',
        json: ids === 'all' ? { all: true } : { ids } });
      await load(true);
    } catch {
      setError(copy('Could not mark as read. Try again.', 'ثبت وضعیت خواندن ناموفق بود. دوباره تلاش کنید.'));
    }
  };

  const items = (inbox?.items ?? []).filter(item => tab === 'all' || categoryOf(item) === tab);
  const unread = inbox?.unreadCount ?? 0;

  return (
    <>
      <button type="button"
        onClick={() => { setTab('all'); setOpen(true); void load(); }}
        aria-label={copy('Notifications', 'اعلان‌ها')}
        aria-haspopup="dialog" aria-expanded={open}
        className="relative grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-white/10 bg-[#272727] text-white transition hover:bg-[#353535] active:scale-95"
      >
        <Bell size={21} strokeWidth={2} aria-hidden />
        {unread > 0 && <span aria-label={copy('Unread notifications', 'اعلان خوانده‌نشده')}
          className="absolute right-1.5 top-1.5 h-3 w-3 rounded-full border-2 border-[#272727] bg-[#FF6B2C] shadow-[0_0_0_2px_rgba(255,107,44,.14)]" />}
      </button>

      {open && (
        <div className="fixed inset-0 z-[125] flex items-end justify-center sm:items-start sm:justify-end sm:px-5 sm:pt-20"
          role="presentation">
          <button type="button" tabIndex={-1}
            aria-label={copy('Close notifications', 'بستن اعلان‌ها')}
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-black/70 backdrop-blur-[3px] sm:bg-black/45" />
          <div ref={dialogRef} role="dialog" aria-modal="true"
            aria-label={copy('Notifications', 'اعلان‌ها')}
            dir={fa ? 'rtl' : 'ltr'}
            className="relative z-10 flex h-[91dvh] w-full max-w-[550px] flex-col overflow-hidden rounded-t-[30px] bg-white text-[#141414] shadow-[0_24px_85px_rgba(0,0,0,.45)] motion-safe:animate-[novaFadeIn_.22s_ease-out] sm:h-auto sm:max-h-[83dvh] sm:rounded-[28px]">
            <div className="flex shrink-0 items-center justify-between gap-2 px-5 pb-3 pt-6 sm:px-6">
              <h2 className="text-[25px] font-black tracking-tight">{copy('Notifications', 'اعلان‌ها')}</h2>
              <button data-notification-close type="button" onClick={() => setOpen(false)}
                aria-label={copy('Close', 'بستن')}
                className="grid h-10 w-10 place-items-center rounded-full text-[#787B84] transition hover:bg-[#F1F1F3] hover:text-black">
                <X size={26} />
              </button>
            </div>
            <div className="shrink-0 px-4 pb-4 sm:px-6">
              <div className="grid grid-cols-3 gap-1 rounded-[17px] bg-[#F3F3F4] p-1">
                {(['all','personal','general'] as const).map(value => (
                  <button key={value} type="button" onClick={() => setTab(value)}
                    aria-pressed={tab === value}
                    className={`min-h-[48px] rounded-[13px] px-2 text-[15px] font-bold transition-all duration-200 ${tab === value ?
                      'bg-[#087CF5] text-white shadow-[0_4px_13px_rgba(8,124,245,.24)]' : 'text-[#181818] hover:bg-[#E9E9EC]'}`}>
                    {value === 'all' ? copy('All','همه') : value === 'personal' ? copy('Personal','شخصی') : copy('General','عمومی')}
                  </button>
                ))}
              </div>
            </div>
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 pb-5 sm:px-6">
              {!authenticated && !sessionLoading ? (
                <EmptyAlerts title={copy('Sign in to see notifications','برای مشاهده اعلان‌ها وارد شوید')}
                  hint={copy('Your personal updates will appear here.','پیام‌های شخصی شما در این قسمت نمایش داده می‌شوند.')} />
              ) : loading && !inbox ? (
                <div className="space-y-3" aria-busy="true">
                  {[0,1].map(v => <div key={v} className="h-44 animate-pulse rounded-3xl bg-[#E7E8EC]" />)}
                </div>
              ) : items.length === 0 ? (
                <EmptyAlerts title={copy('No results','پیامی موجود نیست')}
                  hint={copy('When a notification arrives, it will appear in this section.',
                    'با دریافت اعلان جدید، پیام آن در این بخش نمایش داده می‌شود.')} />
              ) : items.map(item => {
                const action = actionFor(item);
                return <article key={item.id}
                  className="rounded-[24px] bg-[#EBEBEF] px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,.9)] sm:px-5">
                  <div className="flex items-start justify-between gap-3">
                    <time className="text-[13px] text-[#6D6F78]">{readableDate(item.createdAt,locale)}</time>
                    {item.readAt === null && <span className="rounded-full bg-[#FF632D] px-3 py-0.5 text-xs font-black text-white">
                      {copy('New','جدید')}</span>}
                  </div>
                  <h3 dir="auto" className="mt-1 text-[17px] font-black">{item.title}</h3>
                  <p dir="auto" className="mt-1.5 whitespace-pre-line text-[14px] leading-6 text-[#62636E]">{item.body}</p>
                  {action ? (
                    <button type="button" onClick={async () => {
                      if (!item.readAt) await mark([item.id]);
                      setOpen(false); router.push(action.href);
                    }}
                      className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-[13px] bg-[#087CF5] px-4 text-sm font-black text-white transition hover:bg-[#006BE5] active:scale-[.985]">
                      {action.label}<ChevronRight size={17} />
                    </button>
                  ) : item.readAt === null && (
                    <button type="button" onClick={() => void mark([item.id])}
                      className="mt-3 text-xs font-bold text-[#087CF5] hover:underline">
                      {copy('Mark as read','علامت‌گذاری به‌عنوان خوانده‌شده')}
                    </button>
                  )}
                </article>;
              })}
              {error && <p role="alert" className="text-center text-xs text-red-600">{error}</p>}
            </div>
            {authenticated && unread > 0 && (
              <div className="shrink-0 border-t border-[#E7E7EA] bg-white px-5 py-3 text-right">
                <button type="button" onClick={() => void mark('all')}
                  className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold text-[#087CF5] hover:bg-[#EFF6FF]">
                  <CheckCheck size={17} />{copy('Mark all as read','خواندن همه اعلان‌ها')}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function EmptyAlerts({ title, hint }: { title: string; hint: string }) {
  return <div className="flex min-h-[43vh] flex-col items-center justify-center px-7 text-center">
    <span className="grid h-20 w-20 place-items-center rounded-full bg-[#F4F5F7] text-[#626771]">
      <Bell size={39} fill="currentColor" strokeWidth={1.5} />
    </span>
    <p className="mt-5 text-xl font-black">{title}</p>
    <p className="mt-2 max-w-[310px] text-sm leading-6 text-[#666B75]">{hint}</p>
  </div>;
}
