'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { PHASES } from '@/types'

export function CreateProjectForm({ userId }: { userId: string }) {
  const router = useRouter()
  const supabase = createClient()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [description, setDescription] = useState('')
  const [phase, setPhase] = useState('Gros œuvre')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function create() {
    if (!name.trim() || loading) return
    setLoading(true)
    setError(null)

    const { data: project, error: insertError } = await supabase
      .from('projects')
      .insert({ name: name.trim(), address: address.trim(), description: description.trim(), phase, owner_id: userId, progress: 0 })
      .select()
      .single()

    // L'erreur était avalée en silence : le bouton restait sans effet et
    // l'utilisateur n'avait aucun moyen de savoir ce qui bloquait.
    if (insertError || !project) {
      setLoading(false)
      setError(`Création du projet impossible : ${insertError?.message ?? 'réponse vide du serveur'}`)
      return
    }

    const { error: memberError } = await supabase
      .from('project_members')
      .insert({ project_id: project.id, user_id: userId, role: 'admin' })

    if (memberError) {
      setLoading(false)
      setError(`Projet créé, mais l'ajout du membre a échoué : ${memberError.message}`)
      return
    }

    setOpen(false)
    setLoading(false)
    router.refresh()
    router.push(`/project/${project.id}`)
  }

  const inp = { width: '100%', padding: '9px 12px', fontSize: 13, background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', marginBottom: 12 } as React.CSSProperties
  const lbl = { fontSize: 10, fontWeight: 700, color: 'var(--text3)', display: 'block', marginBottom: 5, letterSpacing: '0.8px', fontFamily: "'Barlow Condensed',sans-serif" } as React.CSSProperties

  if (!open) return (
    <button onClick={() => setOpen(true)} style={{
      padding: '12px 22px', background: 'var(--amber)', border: 'none',
      borderRadius: 9, color: '#0A0B0D', fontSize: 13, fontWeight: 800, cursor: 'pointer',
      fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: '1px', display: 'flex', alignItems: 'center', gap: 8,
    }}>
      🏗️ NOUVEAU PROJET CHANTIER
    </button>
  )

  return (
    <div style={{ background: 'var(--bg2)', border: '1px solid rgba(245,166,35,0.25)', borderRadius: 12, padding: 24, maxWidth: 500 }}>
      <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 20, fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: '0.5px' }}>NOUVEAU PROJET</h2>

      <label style={lbl}>NOM DU PROJET *</label>
      <input value={name} onChange={e => setName(e.target.value)} placeholder="Résidence Les Jardins..." autoFocus style={inp} />

      <label style={lbl}>ADRESSE</label>
      <input value={address} onChange={e => setAddress(e.target.value)} placeholder="Boulevard X, Casablanca" style={inp} />

      <label style={lbl}>DESCRIPTION</label>
      <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Description du projet..." rows={2} style={{ ...inp, resize: 'vertical' }} />

      <label style={lbl}>PHASE INITIALE</label>
      <select value={phase} onChange={e => setPhase(e.target.value)} style={{ ...inp, cursor: 'pointer' }}>
        {PHASES.map(p => <option key={p} value={p}>{p}</option>)}
      </select>

      {error && (
        <div style={{ padding: '9px 12px', background: 'rgba(232,64,64,0.1)', border: '1px solid rgba(232,64,64,0.3)', borderRadius: 7, fontSize: 12, color: '#E84040', marginTop: 4 }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
        <button onClick={create} disabled={!name.trim() || loading} style={{
          flex: 1, padding: '10px', background: name.trim() && !loading ? 'var(--amber)' : 'var(--bg4)',
          border: 'none', borderRadius: 8, color: name.trim() && !loading ? '#0A0B0D' : 'var(--text3)',
          fontSize: 13, fontWeight: 800, cursor: name.trim() && !loading ? 'pointer' : 'not-allowed',
          fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: '1px',
        }}>
          {loading ? 'CRÉATION...' : 'CRÉER LE PROJET'}
        </button>
        <button onClick={() => setOpen(false)} style={{
          padding: '10px 18px', background: 'var(--bg3)', border: '1px solid var(--border)',
          borderRadius: 8, color: 'var(--text2)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
        }}>
          Annuler
        </button>
      </div>
    </div>
  )
}
