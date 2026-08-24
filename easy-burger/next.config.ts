import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Volontairement PAS de `ignoreBuildErrors` ni `ignoreDuringBuilds`.
  // On manipule un ledger de points et des montants en centimes :
  // un build qui casse sur une erreur de typage est le comportement voulu.
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/**',
      },
    ],
  },
  async headers() {
    return [
      {
        // Le service worker ne doit jamais être servi depuis le cache HTTP,
        // sinon un déploiement ne se propage pas.
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
    ]
  },
}

export default nextConfig
