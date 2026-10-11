import type { MetadataRoute } from 'next';
import { publicConfig } from '@/server/env';

export default function robots(): MetadataRoute.Robots {
  const config = publicConfig();
  return {
    rules: [
      { userAgent: '*', allow: ['/', '/live', '/sports', '/match', '/help', '/legal'], disallow: ['/admin', '/api', '/account', '/wallet', '/affiliate'] },
    ],
    sitemap: `${config.siteUrl.replace(/\/$/, '')}/sitemap.xml`,
    host: config.siteUrl,
  };
}
