import type { MetadataRoute } from 'next';
import { publicConfig } from '@/server/env';

export default function manifest(): MetadataRoute.Manifest {
  const config = publicConfig();
  return {
    name: 'BetVima',
    short_name: 'BetVima',
    description: 'BetVima Sportsbook',
    start_url: '/',
    display: 'standalone',
    background_color: '#000410',
    theme_color: '#000410',
    orientation: 'portrait-primary',
    lang: 'en',
    dir: 'ltr',
    icons: [
      { src: '/betvima-app-icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    ]
  };
}
