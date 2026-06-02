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

export function AuthForm({ mode }: { mode: 'login' | 'register' }) {
  const router = useRouter()
  const supabase = createClient()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) { setError('Email ou mot de passe incorrect'); setLoading(false); return }
      router.push('/dashboard')
      router.refresh()
    } else {
      if (password.length < 8) { setError('Mot de passe : 8 caractères minimum'); setLoading(false); return }
      const { error } = await supabase.auth.signUp({
        email, password,
        options: { data: { full_name: fullName } },
      })
      if (error) { setError(error.message); setLoading(false); return }
      router.push('/dashboard')
      router.refresh()
    }
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

      {error && (
        <div style={{ padding: '9px 12px', background: 'rgba(232,64,64,0.1)', border: '1px solid rgba(232,64,64,0.3)', borderRadius: 7, fontSize: 12, color: '#E84040', marginBottom: 14 }}>
          {error}
        </div>
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
