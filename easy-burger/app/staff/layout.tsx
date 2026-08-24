import type { Metadata } from 'next'
import Link from 'next/link'
import { Logo } from '@/components/brand/Logo'
import { Eyebrow } from '@/components/ui/Eyebrow'

export const metadata: Metadata = {
  title: 'Caisse',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

/** Écran caisse : pensé pour un téléphone tenu d'une main, au comptoir. */
export default function StaffLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-eb-white">
      <header className="border-b border-eb-line bg-eb-black text-eb-white pt-safe">
        <div className="mx-auto flex h-14 max-w-lg items-center justify-between px-4">
          <Logo variant="blanc-orange" width={110} />
          <Link href="/admin" className="eb-eyebrow font-util text-eb-cream">
            back-office
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-lg px-4 py-6">{children}</main>
      <footer className="mx-auto max-w-lg px-4 pb-8">
        <Eyebrow className="text-eb-grey">
          demande toujours le numéro avant d’encaisser
        </Eyebrow>
      </footer>
    </div>
  )
}
