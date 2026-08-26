'use client'

import { useEffect, useState } from 'react'

/**
 * §9 — compte à rebours de 15 minutes sous le code.
 *
 * Calculé à partir de l'échéance renvoyée par le serveur, jamais d'une durée
 * fixe : un onglet laissé ouvert ou une horloge décalée ne doivent pas faire
 * croire qu'un code est encore valable.
 */
export function CodeCountdown({ expiresAt }: { expiresAt: string }) {
  const [left, setLeft] = useState(() => remaining(expiresAt))

  useEffect(() => {
    const id = window.setInterval(() => setLeft(remaining(expiresAt)), 1000)
    return () => window.clearInterval(id)
  }, [expiresAt])

  if (left <= 0) {
    return (
      <p className="text-body-l">
        Code expiré. Tes points te sont rendus automatiquement.
      </p>
    )
  }

  const m = Math.floor(left / 60)
  const s = left % 60

  return (
    <p className="eb-price text-body-l" aria-live="polite">
      expire dans {m}:{String(s).padStart(2, '0')}
    </p>
  )
}

function remaining(expiresAt: string): number {
  return Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000))
}
