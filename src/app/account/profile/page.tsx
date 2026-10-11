import { Header, MobileTabBar } from '@/components/layout/page-shell';
import { ProfileClient } from '@/components/account/profile-client';
import { BetSlipRail } from '@/components/betting/bet-slip';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Profile' };

export default function ProfilePage() {
  return (
    <div className="min-h-dvh bg-[#F1F2F5]">
      <Header hideSportsNav />
      <ProfileClient />
      <BetSlipRail />
      <MobileTabBar />
    </div>
  );
}
