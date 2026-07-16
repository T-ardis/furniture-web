import type { MetadataRoute } from 'next';
import { getConfig } from '@/lib/config';

const BASE = 'https://app.tardis-ai.com';

export default function sitemap(): MetadataRoute.Sitemap {
  // When the demo is live, `/` redirects to the noindex /demo (see next.config.ts),
  // so it must not be advertised as an indexable URL.
  const root: MetadataRoute.Sitemap = getConfig().isDemoConfigured
    ? []
    : [
        {
          url: BASE,
          lastModified: new Date(),
          changeFrequency: 'weekly',
          priority: 1,
        },
      ];

  return [
    ...root,
    {
      url: `${BASE}/ar-furniture-viewer`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.9,
    },
    {
      url: `${BASE}/3d-furniture-model-generator`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.9,
    },
    {
      url: `${BASE}/room-visualizer`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.9,
    },
  ];
}
