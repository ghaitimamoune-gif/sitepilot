'use client'

import { useEffect } from 'react'

/**
 * Frontière d'erreur applicative : une exception dans une page rend cet écran
 * au lieu d'une page blanche, et propose de réessayer.
 */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('[SitePilot] Erreur de rendu :', error)
  }, [error])

  const isConfigError = error.message.includes('Configuration Supabase incomplète')

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, background: 'var(--bg)' }}>
      <div style={{ width: '100%', maxWidth: 520, background: 'var(--bg2)', border: '1px solid rgba(232,64,64,0.3)', borderRadius: 12, padding: 28 }}>
        <div style={{ fontSize: 32, marginBottom: 14 }}>⚠️</div>
        <h1 style={{ fontSize: 19, fontWeight: 700, color: 'var(--text)', marginBottom: 8, fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: '0.5px' }}>
          {isConfigError ? 'CONFIGURATION INCOMPLÈTE' : 'UNE ERREUR EST SURVENUE'}
        </h1>
        <p style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 18, lineHeight: 1.6 }}>
          {isConfigError
            ? 'L\'application n\'a pas pu joindre la base de données.'
            : 'La page n\'a pas pu être affichée. L\'incident a été enregistré dans les journaux du serveur.'}
        </p>

        <pre style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 7, padding: '10px 12px', fontSize: 11, color: 'var(--text2)', whiteSpace: 'pre-wrap', wordBreak: 'break-word', marginBottom: 18 }}>
          {error.message}
        </pre>

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={reset} style={{ padding: '9px 18px', background: 'var(--amber)', border: 'none', borderRadius: 8, color: '#0A0B0D', fontSize: 12, fontWeight: 800, cursor: 'pointer', fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: '1px' }}>
            RÉESSAYER
          </button>
          <a href="/dashboard" style={{ padding: '9px 18px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text2)', fontSize: 12, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700, letterSpacing: '0.5px' }}>
            MES PROJETS
          </a>
        </div>
      </div>
    </div>
  )
}
