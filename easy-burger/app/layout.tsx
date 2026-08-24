import type { Metadata, Viewport } from 'next'
import { Anton, Archivo, Inter } from 'next/font/google'
import { ServiceWorker } from '@/components/pwa/ServiceWorker'
import './globals.css'

/* §4.2 — trois rôles, trois polices. Chargées par next/font : les fichiers
   sont servis depuis notre domaine, pas de requête vers Google au runtime,
   pas de FOUT. */
const display = Anton({
  subsets: ['latin'],
  weight: '400',
  display: 'swap',
  variable: '--font-display',
})

const sans = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-sans',
})

const util = Archivo({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-util',
})

export const metadata: Metadata = {
  title: {
    default: 'Easy Burger — Casablanca',
    template: '%s · Easy Burger',
  },
  description:
    'Commandez vos smash burgers en livraison ou à emporter, et cumulez des points à chaque visite.',
  manifest: '/manifest.json',
  applicationName: 'Easy Burger',
  appleWebApp: {
    capable: true,
    title: 'Easy Burger',
    statusBarStyle: 'black-translucent',
  },
  icons: {
    icon: [
      { url: '/icons/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icons/favicon-16.png', sizes: '16x16', type: 'image/png' },
    ],
    apple: '/icons/apple-touch-icon.png',
  },
  formatDetection: { telephone: false },
}

export const viewport: Viewport = {
  themeColor: '#111111',
  width: 'device-width',
  initialScale: 1,
  // L'app est utilisée d'une main, debout : on ne bloque pas le zoom,
  // c'est un besoin d'accessibilité réel.
  maximumScale: 5,
  viewportFit: 'cover',
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="fr"
      className={`${display.variable} ${sans.variable} ${util.variable}`}
    >
      <body>
        {children}
        <ServiceWorker />
      </body>
    </html>
  )
}
