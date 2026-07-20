import type { MetadataRoute } from 'next';

const siteUrl = 'https://mssolutioninformatique.com';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/dashboard', '/login'],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
