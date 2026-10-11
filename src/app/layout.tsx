import type { Metadata, Viewport } from 'next';
import './globals.css';
import { AppProviders } from '@/components/layout/providers';
import { PwaRegister } from '@/components/layout/pwa-register';
import { publicConfig } from '@/server/env';

const config = publicConfig();

export const metadata: Metadata = {
  title: { default: `${config.siteName} — Sports betting`, template: `%s | ${config.siteName}` },
  description: 'BetVima — sportsbook with automatic settlement, secure wallet management and a full betting platform.',
  applicationName: config.siteName,
  metadataBase: new URL(config.siteUrl),
  manifest: '/manifest.webmanifest',
  openGraph: { title: config.siteName, description: config.siteName, type: 'website', locale: 'en_US' },
  twitter: { card: 'summary_large_image' },
  icons: { icon: '/brand/betvima-bv.png', apple: '/brand/betvima-bv.png' },
  robots: { index: config.isProduction, follow: config.isProduction },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#111111',
  colorScheme: 'dark',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" dir="ltr">
      <body>
        <AppProviders initialLocale={config.locale}>
          {children}
          <PwaRegister />
        </AppProviders>
      </body>
    </html>
  );
}
