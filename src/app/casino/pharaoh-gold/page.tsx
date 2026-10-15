import type { Metadata } from 'next';
import { PharaohGoldSlot } from '@/components/casino/pharaoh-gold-slot';

export const metadata: Metadata = {
  title: 'Pharaoh Gold · BetVima Casino',
  description: 'Original cinematic Egyptian-themed slot game. USD $0.10 minimum demo bet. No real money.',
  robots: { index: false, follow: false },
};
export default function PharaohGoldPage() {
  return <PharaohGoldSlot />;
}
