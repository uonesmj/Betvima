import type { Metadata } from 'next';
import { RoyalNeonSlot } from '@/components/casino/royal-neon-slot';

export const metadata: Metadata = {
  title: 'Royal Neon — Free Demo',
  description: 'Play a free five-reel, ten-payline BetVima original game prototype with virtual credits. No real-money wagering.',
  robots: { index: false, follow: false },
};

export default function RoyalNeonDemoPage() {
  return <RoyalNeonSlot />;
}
