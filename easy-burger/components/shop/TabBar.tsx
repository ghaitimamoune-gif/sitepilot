'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/cn'

/** §9 — trois onglets. Pas plus. */
const TABS = [
  { href: '/', label: 'Menu' },
  { href: '/fidelite', label: 'Fidélité' },
  { href: '/compte', label: 'Compte' },
]

export function TabBar({ signedIn }: { signedIn: boolean }) {
  const pathname = usePathname()

  // Le checkout et le suivi sont des tunnels : on n'y montre pas de sortie.
  if (pathname.startsWith('/commande') || pathname.startsWith('/suivi')) return null

  return (
    <nav
      aria-label="Navigation principale"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-eb-line bg-eb-white pb-safe"
    >
      <ul className="mx-auto flex max-w-3xl">
        {TABS.map((tab) => {
          const active =
            tab.href === '/' ? pathname === '/' : pathname.startsWith(tab.href)
          const href =
            !signedIn && tab.href !== '/'
              ? `/connexion?suite=${encodeURIComponent(tab.href)}`
              : tab.href

          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'eb-eyebrow flex h-[60px] items-center justify-center font-util',
                  active ? 'text-eb-black' : 'text-eb-grey',
                )}
              >
                <span
                  className={cn(
                    'border-b-2 py-1',
                    active ? 'border-eb-orange' : 'border-transparent',
                  )}
                >
                  {tab.label}
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
