import Link from 'next/link'
import { CartProvider } from '@/lib/cart'
import { CartBar } from '@/components/cart/CartBar'
import { TabBar } from '@/components/shop/TabBar'
import { Logo } from '@/components/brand/Logo'
import { getCurrentCustomer } from '@/lib/customer'

export const dynamic = 'force-dynamic'

/** Coquille du parcours client : entête, panier persistant, trois onglets. */
export default async function ShopLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const customer = await getCurrentCustomer()

  return (
    <CartProvider>
      <div className="min-h-dvh bg-eb-white">
        <header className="sticky top-0 z-30 border-b border-eb-line bg-eb-white pt-safe">
          <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
            <Link href="/" aria-label="Easy Burger — accueil">
              <Logo variant="noir-orange" width={120} priority />
            </Link>

            {customer && (
              <Link href="/fidelite" className="flex items-baseline gap-1.5">
                <span className="eb-price font-display text-display-m leading-none">
                  {customer.points_balance}
                </span>
                <span className="eb-eyebrow font-util text-eb-grey">points</span>
              </Link>
            )}
          </div>
        </header>

        {/* Marge basse : barre d'onglets + barre panier. */}
        <main className="mx-auto max-w-3xl pb-40">{children}</main>

        <CartBar />
        <TabBar signedIn={Boolean(customer)} />
      </div>
    </CartProvider>
  )
}
