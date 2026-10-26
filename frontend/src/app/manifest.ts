import type { MetadataRoute } from 'next';

// Installing the site (Add to Home Screen) uses these icons (docs/ui/brand.md). Only the brand name
// is shown, so there is nothing to translate.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'VirtualBiz',
    short_name: 'VirtualBiz',
    start_url: '/',
    display: 'standalone',
    background_color: '#F2F2F7',
    theme_color: '#F5B800',
    icons: [
      { src: '/brand/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/brand/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      {
        src: '/brand/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
