'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Languages } from 'lucide-react';
import { LOCALE_META } from '@/lib/i18n/locale-meta';
import { LOCALES, type Locale } from '@/lib/i18n';
import { useApp } from './providers';

type LanguageSelectorProps = {
  variant?: 'drawer' | 'footer';
};

export function LanguageSelector({ variant = 'drawer' }: LanguageSelectorProps) {
  const { locale, setLocale, t } = useApp();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  const compact = variant === 'footer';

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t('language.select')}
        onClick={() => setOpen((value) => !value)}
        className={
          compact
            ? 'inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-white/80 transition hover:bg-white/[0.08]'
            : 'inline-flex h-10 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 text-sm font-semibold text-white transition hover:bg-white/[0.08]'
        }
      >
        <Languages className="h-4 w-4" />
        <span translate="no">{LOCALE_META[locale].nativeLabel}</span>
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          role="menu"
          className={`absolute z-[100] min-w-[150px] overflow-hidden rounded-2xl border border-white/10 bg-[#111827] p-1.5 shadow-2xl ${
            compact ? 'bottom-full left-0 mb-2' : 'right-0 top-full mt-2'
          }`}
        >
          {LOCALES.map((item: Locale) => (
            <button
              key={item}
              type="button"
              role="menuitem"
              onClick={() => {
                setLocale(item);
                setOpen(false);
              }}
              className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-sm transition ${
                locale === item
                  ? 'bg-white/[0.08] font-bold text-white'
                  : 'text-white/65 hover:bg-white/[0.05] hover:text-white'
              }`}
            >
              <span translate="no">{LOCALE_META[item].nativeLabel}</span>
              {locale === item && <span className="text-[10px] font-bold text-[#2DD4BF]">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
