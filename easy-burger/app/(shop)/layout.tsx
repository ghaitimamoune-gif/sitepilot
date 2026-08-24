import Link from 'next/link'
import { CartProvider } from '@/lib/cart'
import { CartBar } from '@/components/cart/CartBar'
import { Logo } from '@/components/brand/Logo'

/** Coquille du parcours client : entête, panier persistant, barre collante. */
export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return (
    <CartProvider>
      <div className="min-h-dvh bg-eb-white">
        <header className="sticky top-0 z-30 border-b border-eb-line bg-eb-white pt-safe">
          <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
            <Link href="/" aria-label="Easy Burger — accueil">
              <Logo variant="noir-orange" width={120} priority />
            </Link>
            <Link
              href="/panier"
              className="eb-eyebrow font-util text-eb-grey"
            >
              panier
            </Link>
          </div>
        </header>

        <main className="mx-auto max-w-3xl pb-28">{children}</main>

        <CartBar />
      </div>
    </CartProvider>
  )
}
