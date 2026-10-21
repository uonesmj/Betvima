import type { Metadata } from 'next';
import { AffiliateShowcase } from '@/components/affiliate/affiliate-promo';

export const metadata: Metadata = {
  title: 'BetVima Partners | Affiliate Program',
  description: 'Explore the BetVima affiliate program, products, partner tools, and how to join.',
};

export default function PartnersPage() {
  return <AffiliateShowcase />;
}
