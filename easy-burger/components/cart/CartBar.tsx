'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useCart } from '@/lib/cart'
import { formatMAD } from '@/lib/money'

/**
 * Barre collante « voir le panier ».
 *
 * Elle disparaît sur le panier et le checkout : §9 impose trois écrans
 * maximum entre le panier et la commande passée, une barre qui renvoie
 * vers l'écran courant est un écran de perdu.
 */
export function CartBar() {
  const { count, subtotalCents, ready } = useCart()
  const pathname = usePathname()

  const hidden =
    !ready ||
    count === 0 ||
    pathname === '/panier' ||
    pathname.startsWith('/commande') ||
    pathname.startsWith('/suivi')

  if (hidden) return null

  return (
    // Calée juste au-dessus de la barre d'onglets.
    <div className="fixed inset-x-0 bottom-tabbar z-40 bg-eb-white px-4 pt-3 pb-3">
      <Link
        href="/panier"
        className="mx-auto flex h-14 max-w-3xl items-center justify-between rounded-button bg-eb-orange px-5 text-eb-white"
      >
        <span className="font-sans text-body-l font-semibold">
          Voir le panier
        </span>
        <span className="eb-price font-sans text-body-l font-semibold">
          {count} {count > 1 ? 'articles' : 'article'} · {formatMAD(subtotalCents)}
        </span>
      </Link>
    </div>
  )
}
