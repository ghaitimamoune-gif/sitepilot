'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const inp = {
  width: '100%', padding: '10px 12px', fontSize: 13,
  background: 'var(--bg3)', border: '1px solid var(--border)',
  borderRadius: 8, color: 'var(--text)', marginBottom: 12,
} as React.CSSProperties

const lbl = {
  fontSize: 10, fontWeight: 700, color: 'var(--text3)',
  display: 'block', marginBottom: 5, letterSpacing: '0.8px',
  fontFamily: "'Barlow Condensed',sans-serif",
} as React.CSSProperties

const notice = (color: string) => ({
  padding: '10px 12px',
  background: `${color}1A`,
  border: `1px solid ${color}4D`,
  borderRadius: 7,
  fontSize: 12,
  color,
  marginBottom: 14,
  lineHeight: 1.55,
}) as React.CSSProperties

/**
 * Traduit l'erreur renvoyée par Supabase en message exploitable.
 *
 * L'ancienne version affichait « Email ou mot de passe incorrect » pour
 * *toute* erreur de connexion. Un compte dont l'adresse n'est pas confirmée
 * — cas par défaut sur Supabase — donnait donc l'impression que les
 * identifiants étaient faux, alors qu'ils étaient corrects.
 */
function messageDeConnexion(err: { message: string; code?: string; status?: number }): {
  text: string
  needsConfirmation: boolean
} {
  const code = err.code ?? ''
  const raw = err.message.toLowerCase()

  if (code === 'email_not_confirmed' || raw.includes('email not confirmed')) {
    return {
      text: "Ce compte existe et le mot de passe est correct, mais l'adresse e-mail n'a jamais été confirmée. Ouvrez le lien reçu par e-mail, ou demandez un nouvel envoi ci-dessous.",
      needsConfirmation: true,
    }
  }
  if (code === 'invalid_credentials' || raw.includes('invalid login credentials')) {
    return { text: 'Email ou mot de passe incorrect.', needsConfirmation: false }
  }
  if (code === 'over_request_rate_limit' || err.status === 429 || raw.includes('rate limit')) {
    return { text: 'Trop de tentatives. Patientez quelques minutes avant de réessayer.', needsConfirmation: false }
  }
  if (code === 'user_banned') {
    return { text: 'Ce compte est suspendu. Contactez un administrateur du projet.', needsConfirmation: false }
  }
  if (raw.includes('fetch') || raw.includes('network') || raw.includes('failed to fetch')) {
    return {
      text: "Impossible de joindre le serveur d'authentification. Le projet Supabase est peut-être en veille ou la configuration est incorrecte.",
      needsConfirmation: false,
    }
  }
  // Cas non répertorié : afficher le message réel plutôt qu'un diagnostic inventé.
  return { text: `Connexion refusée : ${err.message}`, needsConfirmation: false }
}

export function AuthForm({ mode }: { mode: 'login' | 'register' }) {
  const router = useRouter()
  const supabase = createClient()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [canResend, setCanResend] = useState(false)

  async function resendConfirmation() {
    if (!email) { setError('Renseignez votre adresse e-mail avant de demander un nouvel envoi.'); return }
    setLoading(true)
    setError('')
    setInfo('')
    const { error: err } = await supabase.auth.resend({ type: 'signup', email })
    setLoading(false)
    if (err) { setError(`Envoi impossible : ${err.message}`); return }
    setCanResend(false)
    setInfo(`E-mail de confirmation renvoyé à ${email}. Pensez à vérifier les indésirables.`)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    setInfo('')
    setCanResend(false)

    if (mode === 'login') {
      const { error: err } = await supabase.auth.signInWithPassword({ email, password })
      if (err) {
        const { text, needsConfirmation } = messageDeConnexion(err)
        setError(text)
        setCanResend(needsConfirmation)
        setLoading(false)
        return
      }
      router.push('/dashboard')
      router.refresh()
      return
    }

    if (password.length < 8) {
      setError('Mot de passe : 8 caractères minimum')
      setLoading(false)
      return
    }

    const { data, error: err } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    })
    if (err) { setError(err.message); setLoading(false); return }

    // Supabase renvoie un utilisateur sans identité lorsque l'adresse est déjà
    // enregistrée — sans lever d'erreur, pour ne pas révéler l'existence du compte.
    if (data.user && data.user.identities && data.user.identities.length === 0) {
      setError("Cette adresse est déjà associée à un compte. Utilisez la page de connexion.")
      setLoading(false)
      return
    }

    // Confirmation par e-mail activée : aucune session n'est ouverte. Rediriger
    // vers /dashboard renverrait aussitôt l'utilisateur vers la connexion, ce qui
    // donnait l'impression que l'inscription avait échoué.
    if (!data.session) {
      setLoading(false)
      setInfo(
        `Compte créé. Un e-mail de confirmation a été envoyé à ${email} : ouvrez le lien qu'il contient, puis connectez-vous.`
      )
      return
    }

    router.push('/dashboard')
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit}>
      {mode === 'register' && (
        <div>
          <label style={lbl}>NOM COMPLET</label>
          <input type="text" value={fullName} onChange={e => setFullName(e.target.value)}
            placeholder="Votre nom complet" required style={inp} />
        </div>
      )}
      <div>
        <label style={lbl}>EMAIL</label>
        <input type="email" value={email} onChange={e => setEmail(e.target.value)}
          placeholder="vous@exemple.com" required style={inp} />
      </div>
      <div>
        <label style={lbl}>MOT DE PASSE</label>
        <input type="password" value={password} onChange={e => setPassword(e.target.value)}
          placeholder={mode === 'register' ? '8 caractères minimum' : '••••••••'} required style={inp} />
      </div>

      {error && <div style={notice('#E84040')}>{error}</div>}
      {info && <div style={notice('#2EC972')}>{info}</div>}

      {canResend && (
        <button type="button" onClick={resendConfirmation} disabled={loading} style={{
          width: '100%', padding: '9px', marginBottom: 12,
          background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8,
          color: 'var(--amber)', fontSize: 12, fontWeight: 700,
          cursor: loading ? 'not-allowed' : 'pointer',
          fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: '0.8px',
        }}>
          RENVOYER L&apos;E-MAIL DE CONFIRMATION
        </button>
      )}

      <button type="submit" disabled={loading} style={{
        width: '100%', padding: '11px', marginTop: 4,
        background: loading ? 'var(--bg4)' : 'var(--amber)',
        border: 'none', borderRadius: 8, color: loading ? 'var(--text3)' : '#0A0B0D',
        fontSize: 13, fontWeight: 800, cursor: loading ? 'not-allowed' : 'pointer',
        fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: '1.5px', transition: 'all 0.15s',
      }}>
        {loading ? 'CHARGEMENT...' : mode === 'login' ? 'ACCÉDER AU CHANTIER →' : 'CRÉER MON COMPTE →'}
      </button>
    </form>
  )
}
