import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'MS Solution Informatique',
    short_name: 'MS Solution',
    description: 'Plateformes web sur mesure pour les entreprises.',
    start_url: '/',
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
