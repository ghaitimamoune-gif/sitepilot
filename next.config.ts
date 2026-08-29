import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Ne pas bloquer le build de production sur les avertissements ESLint
  eslint: {
    ignoreDuringBuilds: true,
  },
  // La vérification des types est de nouveau active : les incompatibilités
  // liées aux jointures Supabase ont été corrigées, et l'ancien réglage
  // laissait passer en production des erreurs détectables au build.
  // (Le dossier dupliqué `sitepilot/` est exclu via tsconfig.json.)
  typescript: {
    ignoreBuildErrors: false,
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co', port: '', pathname: '/storage/v1/object/**' },
    ],
  },
}

export default nextConfig
