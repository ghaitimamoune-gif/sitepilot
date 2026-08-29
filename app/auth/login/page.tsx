import { redirect } from 'next/navigation'
import { createClientOrNull } from '@/lib/supabase/server'
import { SetupNotice } from '@/components/system/SetupNotice'
import { AuthForm } from '@/components/auth/AuthForm'

// Ces pages dépendent de la session (cookies) : elles doivent être évaluées
// à chaque requête. Sans cela, Next peut les prérendre au build — et figer
// dans le HTML l'état observé au moment de la construction.
export const dynamic = 'force-dynamic'

export default async function LoginPage() {
  const supabase = await createClientOrNull()
  if (!supabase) return <SetupNotice />

  const { data: { user } } = await supabase.auth.getUser()
  if (user) redirect('/dashboard')

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, background: 'var(--bg)' }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 40, justifyContent: 'center' }}>
          <div style={{ width: 36, height: 36, background: 'var(--amber)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>🏗️</div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)', fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: '2px' }}>SITEPILOT</div>
            <div style={{ fontSize: 9, color: 'var(--text3)', fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: '2px' }}>GESTION CHANTIER</div>
          </div>
        </div>

        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, padding: 28 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', marginBottom: 4, fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: '0.5px' }}>Connexion</h1>
          <p style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 24 }}>Accédez à votre espace chantier</p>
          <AuthForm mode="login" />
        </div>

        <p style={{ textAlign: 'center', marginTop: 16, fontSize: 12, color: 'var(--text2)' }}>
          Pas de compte ?{' '}
          <a href="/auth/register" style={{ color: 'var(--amber)', textDecoration: 'none', fontWeight: 600 }}>S&apos;inscrire</a>
        </p>
      </div>
    </div>
  )
}
