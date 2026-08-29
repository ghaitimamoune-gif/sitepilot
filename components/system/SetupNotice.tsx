import { missingSupabaseEnvVars } from '@/lib/supabase/env'

const code: React.CSSProperties = {
  display: 'inline-block',
  background: 'var(--bg4)',
  border: '1px solid var(--border)',
  borderRadius: 5,
  padding: '2px 7px',
  fontSize: 12,
  color: 'var(--amber)',
}

/**
 * Écran affiché lorsque l'application tourne sans configuration Supabase.
 * Il remplace l'ancien comportement : une erreur 500 sans message sur
 * l'ensemble du site.
 */
export function SetupNotice() {
  const missing = missingSupabaseEnvVars()

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, background: 'var(--bg)' }}>
      <div style={{ width: '100%', maxWidth: 560 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28, justifyContent: 'center' }}>
          <div style={{ width: 36, height: 36, background: 'var(--amber)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>🏗️</div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)', fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: '2px' }}>SITEPILOT</div>
            <div style={{ fontSize: 9, color: 'var(--text3)', fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: '2px' }}>GESTION CHANTIER</div>
          </div>
        </div>

        <div style={{ background: 'var(--bg2)', border: '1px solid rgba(245,166,35,0.35)', borderRadius: 12, padding: 28 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', marginBottom: 6, fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: '0.5px' }}>
            CONFIGURATION REQUISE
          </h1>
          <p style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 20, lineHeight: 1.6 }}>
            L&apos;application est déployée, mais elle n&apos;est reliée à aucune base Supabase.
            Aucune donnée — projets, observations, tâches — ne peut être chargée tant que
            les variables ci-dessous ne sont pas renseignées.
          </p>

          <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text3)', letterSpacing: '1px', marginBottom: 8, fontFamily: "'Barlow Condensed',sans-serif" }}>
            VARIABLE(S) MANQUANTE(S)
          </div>
          <ul style={{ listStyle: 'none', marginBottom: 22, display: 'flex', flexDirection: 'column', gap: 7 }}>
            {missing.map(v => (
              <li key={v} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: 'var(--red)', fontSize: 12 }}>✗</span>
                <span style={code}>{v}</span>
              </li>
            ))}
          </ul>

          <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text3)', letterSpacing: '1px', marginBottom: 8, fontFamily: "'Barlow Condensed',sans-serif" }}>
            MARCHE À SUIVRE
          </div>
          <ol style={{ paddingLeft: 18, fontSize: 12, color: 'var(--text2)', lineHeight: 1.85 }}>
            <li>
              Récupérez l&apos;URL et la clé <em>anon</em> dans Supabase → Settings → API.
            </li>
            <li>
              En production : Netlify → Site settings → Environment variables.
              En local : créez un fichier <span style={code}>.env.local</span> à la racine
              (voir <span style={code}>.env.example</span>).
            </li>
            <li>
              <strong style={{ color: 'var(--text)' }}>Relancez un déploiement.</strong> Les variables
              <span style={{ ...code, margin: '0 4px' }}>NEXT_PUBLIC_*</span> sont intégrées au moment
              du build : les ajouter sans reconstruire ne change rien.
            </li>
          </ol>
        </div>
      </div>
    </div>
  )
}
