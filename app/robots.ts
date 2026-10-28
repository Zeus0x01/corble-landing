import type { MetadataRoute } from 'next';

export const dynamic = 'force-static';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/workspace', '/login', '/api'],
      },
    ],
    sitemap: 'https://corble.net/sitemap.xml',
    host: 'https://corble.net',
  };
}
