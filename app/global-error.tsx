'use client'

/**
 * Dernier filet : capture les erreurs survenant dans le layout racine, où
 * `app/error.tsx` ne s'applique pas. Doit fournir ses propres <html>/<body>.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="fr">
      <body style={{ background: '#0A0B0D', color: '#E8EAF0', fontFamily: 'system-ui, sans-serif', margin: 0 }}>
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ maxWidth: 520, background: '#111318', border: '1px solid #252A35', borderRadius: 12, padding: 28 }}>
            <div style={{ fontSize: 32, marginBottom: 14 }}>⚠️</div>
            <h1 style={{ fontSize: 19, marginBottom: 8 }}>SitePilot est momentanément indisponible</h1>
            <p style={{ fontSize: 13, color: '#7C8299', marginBottom: 18, lineHeight: 1.6 }}>
              Une erreur critique a empêché le chargement de l&apos;application.
            </p>
            <pre style={{ background: '#191C23', border: '1px solid #252A35', borderRadius: 7, padding: '10px 12px', fontSize: 11, color: '#7C8299', whiteSpace: 'pre-wrap', wordBreak: 'break-word', marginBottom: 18 }}>
              {error.message}
            </pre>
            <button onClick={reset} style={{ padding: '9px 18px', background: '#F5A623', border: 'none', borderRadius: 8, color: '#0A0B0D', fontSize: 13, fontWeight: 800, cursor: 'pointer' }}>
              Réessayer
            </button>
          </div>
        </div>
      </body>
    </html>
  )
}
