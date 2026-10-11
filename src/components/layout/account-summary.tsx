'use client';


import { UserCircle2 } from 'lucide-react';
import { useApiQuery } from '@/lib/hooks/useApi';
import { useApp } from './providers';

type ProfileResponse = {
  profile?: {
    id?: string;
    publicId?: string;
    numericId?: number;
    email?: string;
    displayName?: string;
  } | null;
};

export function AccountSummary({ onNavigate }: { onNavigate?: () => void }) {
  const { session } = useApp();

  const { data } = useApiQuery<ProfileResponse>(
    session?.authenticated ? '/api/v1/account/profile' : '',
    { pollMs: 60_000 },
  );

  if (!session?.authenticated) return null;

  const profile = data?.profile;
  const email = profile?.email || session.user?.email || '';
  const displayName =
    profile?.displayName?.trim() ||
    email.split('@')[0] ||
    'Account';
  const numericId = profile?.numericId ?? '—';

  return (
    <button type="button"
      
      onClick={() => { onNavigate?.(); window.dispatchEvent(new CustomEvent('nova:open-profile-sheet')); }}
      className="flex items-center gap-3 border-b border-white/[0.07] px-4 py-3.5 transition hover:bg-white/[0.04]"
    >
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#202733] text-nova-primary">
        <UserCircle2 size={22} strokeWidth={1.8} />
      </span>

      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-extrabold text-white">
          {displayName}
        </span>
        <span className="mt-1 block truncate text-[10px] font-semibold text-[#8B95A5]">
          ID: {numericId}
        </span>
      </span>

      <span className="shrink-0 text-[10px] font-bold text-nova-primary">
        Profile
      </span>
    </button>
  );
}
