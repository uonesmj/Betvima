import type { Locale } from './dictionaries';

export const LOCALE_META: Record<Locale, {
  label: string;
  nativeLabel: string;
  dir: 'ltr' | 'rtl';
}> = {
  en: {
    label: 'English',
    nativeLabel: 'English',
    dir: 'ltr',
  },
  fa: {
    label: 'Persian',
    nativeLabel: 'فارسی',
    dir: 'rtl',
  },
};
