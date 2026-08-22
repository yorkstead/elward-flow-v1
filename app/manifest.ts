import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Elward Flow',
    short_name: 'Elward Flow',
    description:
      'Elward Systems operational control from release intake through shipment.',
    start_url: '/dashboard',
    scope: '/',
    display: 'standalone',
    background_color: '#0B1725',
    theme_color: '#1B334F',
    icons: [
      {
        src: '/brand/elward-flow-mark.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },
    ],
  }
}
