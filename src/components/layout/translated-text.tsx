'use client';
import type { ReactNode } from 'react';
import { useApp } from './providers';

export function TranslatedText({ k, fallback, as: Tag = 'span' }: { k: string; fallback?: string; as?: keyof React.JSX.IntrinsicElements }) {
  const { t } = useApp();
  return <Tag>{t(k) || fallback || k}</Tag>;
}
