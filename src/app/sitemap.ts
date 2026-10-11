import type { MetadataRoute } from 'next';
import { createServices } from '@/server/services/container';
import { serviceRoleContext } from '@/server/context';
import { publicConfig } from '@/server/env';

export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const config = publicConfig();
  const base = config.siteUrl.replace(/\/$/, '');
  const now = new Date();
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${base}/`, lastModified: now, changeFrequency: 'hourly', priority: 1 },
    { url: `${base}/live`, lastModified: now, changeFrequency: 'always', priority: 0.9 },
    { url: `${base}/help`, lastModified: now, changeFrequency: 'monthly', priority: 0.4 },
    { url: `${base}/legal/terms`, lastModified: now, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${base}/legal/privacy`, lastModified: now, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${base}/legal/responsible-gaming`, lastModified: now, changeFrequency: 'yearly', priority: 0.2 },
  ];
  try {
    const services = createServices();
    const [sports, matches] = await Promise.all([
      services.catalog.listSports(serviceRoleContext),
      services.catalog.listMatches(serviceRoleContext, { page: 1, pageSize: 50, includeTotal: false }),
    ]);
    return [
      ...staticRoutes,
      ...sports.map((sport) => ({ url: `${base}/sports/${sport.key}`, lastModified: now, changeFrequency: 'daily' as const, priority: 0.7 })),
      ...matches.items.map((match) => ({ url: `${base}/match/${match.id}`, lastModified: new Date(match.updatedAt), changeFrequency: 'hourly' as const, priority: 0.8 })),
    ];
  } catch {
    return staticRoutes;
  }
}
