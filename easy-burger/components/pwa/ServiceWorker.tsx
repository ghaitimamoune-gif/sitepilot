'use client'

import { useEffect } from 'react'

/**
 * Enregistrement du service worker.
 *
 * Volontairement écrit à la main plutôt qu'avec `next-pwa`, qui traîne
 * systématiquement une ou deux versions majeures derrière Next.
 */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return
    if (!('serviceWorker' in navigator)) return

    const register = () => {
      navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {
        // Un enregistrement raté ne doit jamais casser l'app : sans SW,
        // tout fonctionne, c'est juste moins rapide au second chargement.
      })
    }

    if (document.readyState === 'complete') register()
    else window.addEventListener('load', register, { once: true })
  }, [])

  return null
}
