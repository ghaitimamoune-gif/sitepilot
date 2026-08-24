'use client'

import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

type Props = {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  /** Barre d'action collante en pied de feuille (ajouter au panier, payer…). */
  footer?: ReactNode
  className?: string
}

/**
 * Feuille montante — le conteneur des options produit et des confirmations.
 *
 * Construite sur <dialog> natif : la gestion du focus, de la touche Échap et
 * du fond inerte est faite par le navigateur. Pas de librairie, pas de piège
 * d'accessibilité à réimplémenter.
 *
 * §4.3 — rayon 0 : la feuille n'est pas une récompense.
 */
export function Sheet({ open, onClose, title, children, footer, className }: Props) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (open && !el.open) el.showModal()
    if (!open && el.open) el.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        // Clic sur le fond (le <dialog> lui-même, pas son contenu) → fermeture.
        if (e.target === ref.current) onClose()
      }}
      aria-label={title}
      className={cn(
        'w-full max-w-lg bg-eb-white p-0 text-eb-black',
        'mb-0 mt-auto', // ancrée en bas
        'backdrop:bg-eb-black/60',
        className,
      )}
    >
      <div className="flex max-h-[85dvh] flex-col">
        <header className="flex items-center justify-between border-b border-eb-line px-4 py-3">
          <h2 className="text-display-m">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="h-touch w-touch text-body-l text-eb-grey"
          >
            ✕
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-4">{children}</div>

        {footer && (
          <footer className="border-t border-eb-line px-4 py-3 pb-safe">{footer}</footer>
        )}
      </div>
    </dialog>
  )
}
