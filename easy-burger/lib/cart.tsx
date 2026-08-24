'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import type { ReactNode } from 'react'

/**
 * Le panier.
 *
 * Il vit dans le navigateur et survit à un rechargement (§9 : « panier
 * persistant »). Les prix qu'il contient ne servent QU'À L'AFFICHAGE :
 * au moment de commander, seuls les identifiants et les quantités partent
 * au serveur, qui recalcule tout depuis la base. Un panier trafiqué ici
 * ne change aucun montant réel.
 */

export type CartOption = {
  id: string
  name: string
  priceDeltaCents: number
}

export type CartLine = {
  /** Clé de ligne : produit + options choisies. Deux fois le même burger
   *  avec des options différentes font deux lignes. */
  key: string
  productId: string
  slug: string
  name: string
  imageUrl: string | null
  unitPriceCents: number
  qty: number
  options: CartOption[]
}

type CartState = {
  lines: CartLine[]
  /** `false` tant que le panier n'a pas été relu depuis le stockage local. */
  ready: boolean
  add: (line: Omit<CartLine, 'key'>) => void
  setQty: (key: string, qty: number) => void
  remove: (key: string) => void
  clear: () => void
  count: number
  subtotalCents: number
}

const STORAGE_KEY = 'eb.cart.v1'

const CartContext = createContext<CartState | null>(null)

function lineKey(productId: string, options: CartOption[]): string {
  return [productId, ...options.map((o) => o.id).sort()].join('|')
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([])
  const [ready, setReady] = useState(false)

  // Relecture au montage. On ne lit pas pendant le rendu serveur, sinon
  // l'hydratation diverge.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      if (raw) setLines(JSON.parse(raw) as CartLine[])
    } catch {
      // Stockage indisponible (navigation privée, réglages) : on repart
      // d'un panier vide plutôt que de bloquer la commande.
    }
    setReady(true)
  }, [])

  useEffect(() => {
    if (!ready) return
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(lines))
    } catch {
      /* idem */
    }
  }, [lines, ready])

  const add = useCallback((line: Omit<CartLine, 'key'>) => {
    const key = lineKey(line.productId, line.options)
    setLines((prev) => {
      const existing = prev.find((l) => l.key === key)
      if (existing) {
        return prev.map((l) =>
          l.key === key ? { ...l, qty: Math.min(l.qty + line.qty, 50) } : l,
        )
      }
      return [...prev, { ...line, key }]
    })
  }, [])

  const setQty = useCallback((key: string, qty: number) => {
    setLines((prev) =>
      qty <= 0
        ? prev.filter((l) => l.key !== key)
        : prev.map((l) => (l.key === key ? { ...l, qty: Math.min(qty, 50) } : l)),
    )
  }, [])

  const remove = useCallback((key: string) => {
    setLines((prev) => prev.filter((l) => l.key !== key))
  }, [])

  const clear = useCallback(() => setLines([]), [])

  const value = useMemo<CartState>(() => {
    const count = lines.reduce((n, l) => n + l.qty, 0)
    const subtotalCents = lines.reduce((n, l) => n + l.unitPriceCents * l.qty, 0)
    return { lines, ready, add, setQty, remove, clear, count, subtotalCents }
  }, [lines, ready, add, setQty, remove, clear])

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart(): CartState {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart doit être utilisé dans un <CartProvider>')
  return ctx
}

/** Charge utile envoyée à place_order : identifiants et quantités, rien d'autre. */
export function cartToPayloadItems(lines: CartLine[]) {
  return lines.map((l) => ({
    product_id: l.productId,
    qty: l.qty,
    options: l.options.map((o) => o.id),
  }))
}
