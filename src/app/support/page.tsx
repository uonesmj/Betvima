import SupportClient from '@/components/support/support-client';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Online Support | BetVima' };

export default function SupportPage() {
  return <main className="fixed inset-0 z-[145] h-[100dvh] w-screen overflow-hidden bg-white">
    <SupportClient />
  </main>;
}
