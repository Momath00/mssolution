import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'MS Solution Informatique',
    short_name: 'MS Solution',
    description: 'Applications web, logiciels sur mesure et automatisation.',
    start_url: '/login',
    display: 'standalone',
    background_color: '#1a1440',
    theme_color: '#1a1440',
    icons: [
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  };
}
