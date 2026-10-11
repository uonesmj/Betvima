'use client';

import { useCallback, useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { AuthForms } from '@/components/account/auth-forms';
import { useApp } from '@/components/layout/providers';

type AuthMode = 'login' | 'register';

export function AuthSheet({
  mode,
  onClose,
}: {
  mode: AuthMode;
  onClose: () => void;
}) {
  const [visible, setVisible] = useState(false);
  const { t, dir } = useApp();

  const closeSheet = useCallback(() => {
    setVisible(false);
    window.setTimeout(onClose, 280);
  }, [onClose]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setVisible(true));
    const body = document.body;
    body.dataset.novaAuthSheet = '1';
    const scrollY = window.scrollY;
    body.dataset.novaAuthScrollY = String(scrollY);
    body.style.position = 'fixed';
    body.style.top = `-${scrollY}px`;
    body.style.left = '0';
    body.style.right = '0';
    body.style.width = '100%';

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeSheet();
    };

    window.addEventListener('keydown', onKeyDown);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('keydown', onKeyDown);
      body.style.position = '';
      body.style.top = '';
      body.style.left = '';
      body.style.right = '';
      body.style.width = '';
      delete body.dataset.novaAuthSheet;
      const saved = Number(body.dataset.novaAuthScrollY || '0');
      delete body.dataset.novaAuthScrollY;
      window.scrollTo(0, saved);
    };
  }, [closeSheet]);

  return (
    <div
      dir={dir}
      className="fixed inset-0 z-[120] flex items-end justify-center"
      role="dialog"
      aria-modal="true"
      aria-label={mode === 'login' ? t("auth.login") : t("auth.register")}
    >
      <button
        type="button"
        aria-label={t("common.closeAuthentication")}
        onClick={closeSheet}
        className={`absolute inset-0 bg-black/70 backdrop-blur-[2px] transition-opacity duration-300 ${
          visible ? 'opacity-100' : 'opacity-0'
        }`}
      />

      <section
        onClick={(event) => event.stopPropagation()}
        className={`relative flex ${
          mode === 'register'
            ? 'max-h-[calc(100dvh-90px)] sm:max-h-[calc(100dvh-70px)]'
            : 'max-h-[calc(100dvh-10px)] sm:max-h-[calc(100dvh-24px)]'
        } w-full flex-col overflow-hidden rounded-t-[28px] border border-[#24324A] bg-[#07111F] text-white shadow-[0_-20px_70px_rgba(0,0,0,.55)] transition-transform duration-300 ease-out sm:w-[min(620px,100%)] sm:rounded-t-[30px] ${
          visible ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        <div className="shrink-0 px-4 pb-1 pt-3 sm:px-6 sm:pt-4">
          <div className="mx-auto h-1.5 w-12 rounded-full bg-[#71809A]/70" />
          <div className="flex h-9 items-center justify-end">
            <button
              type="button"
              onClick={closeSheet}
              aria-label={t("common.close")}
              className="grid h-10 w-10 place-items-center rounded-full text-[#9AA9C1] transition hover:bg-white/[0.06] hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-7 sm:px-6 sm:pb-8">
          <AuthForms key={mode} initialMode={mode} />
        </div>
      </section>
    </div>
  );
}
