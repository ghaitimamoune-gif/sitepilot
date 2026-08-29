'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useProject } from '@/components/project/ProjectShell'
import { OBS_STATUS_CONFIG, PRIORITY_CONFIG, PHASES, INTERVENANT_TYPES } from '@/types'
import type { ObsHistory, Priority, ObsStatus } from '@/types'

// ============ SHARED UTILS ============
const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : '—'
const timeAgo = (d: string) => { const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000); if (s < 60) return 'à l\'instant'; if (s < 3600) return `${Math.floor(s / 60)}min`; if (s < 86400) return `${Math.floor(s / 3600)}h`; return `${Math.floor(s / 86400)}j` }
const initials = (n: string) => (n || '?').split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2)
let _uid = 0; const uid = () => `c${++_uid}`

function Avt({ name, color, size = 26 }: { name: string; color?: string; size?: number }) {
  return <div style={{ width: size, height: size, borderRadius: '50%', background: color || '#3D8EF0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.36, fontWeight: 700, color: '#fff', flexShrink: 0, fontFamily: "'Barlow Condensed',sans-serif" }}>{initials(name)}</div>
}

function Badge({ label, color, bg, small }: { label: string; color: string; bg: string; small?: boolean }) {
  return <span style={{ display: 'inline-flex', alignItems: 'center', padding: small ? '1px 6px' : '2px 9px', borderRadius: 4, fontSize: small ? 10 : 11, fontWeight: 700, color, background: bg, fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: '0.3px' }}>{label}</span>
}

function PriorityBadge({ priority, small }: { priority: Priority; small?: boolean }) {
  const p = PRIORITY_CONFIG[priority]
  return <Badge label={p?.label || priority} color={p?.color || '#fff'} bg={p?.bg || '#333'} small={small} />
}

function StatusBadge({ status, small }: { status: ObsStatus; small?: boolean }) {
  const s = OBS_STATUS_CONFIG[status]
  return <Badge label={s?.label || status} color={s?.color || '#fff'} bg={`${s?.color || '#fff'}18`} small={small} />
}

const inp = (extra?: object) => ({ width: '100%', padding: '9px 12px', fontSize: 12, background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 7, color: 'var(--text)', fontFamily: 'inherit', ...extra }) as React.CSSProperties
const lbl = { fontSize: 9, fontWeight: 700, color: 'var(--text3)', display: 'block', marginBottom: 5, letterSpacing: '1px', fontFamily: "'Barlow Condensed',sans-serif" } as React.CSSProperties

// ============ DASHBOARD VIEW ============
export function DashboardView() {
  const { data, projectId } = useProject()
  const obs = data.observations, res = data.reserves
  const openObs = obs.filter(o => o.status === 'open').length
  const critObs = obs.filter(o => o.priority === 'critical' && o.status !== 'validated').length
  const openRes = res.filter(r => r.status === 'open').length
  const overdue = data.tasks.filter(t => t.due_date && new Date(t.due_date) < new Date() && t.status !== 'done').length

  const byIv = data.intervenants.map(iv => ({
    ...iv,
    obsCount: obs.filter(o => o.intervenant_id === iv.id && o.status !== 'validated').length,
    resCount: res.filter(r => r.intervenant_id === iv.id && r.status !== 'validated').length,
  })).filter(iv => iv.obsCount > 0 || iv.resCount > 0)

  return (
    <div className="fade-up">
      {/* Project card */}
      <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 18px', marginBottom: 18, display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ width: 40, height: 40, background: 'var(--amber)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>🏗️</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: '0.3px' }}>{data.project.name}</div>
          <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 2 }}>{data.project.address} · <span style={{ color: 'var(--amber)', fontWeight: 600 }}>{data.project.phase}</span></div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 9, color: 'var(--text3)', fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: '1px', marginBottom: 4 }}>AVANCEMENT</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text)', fontFamily: "'Barlow Condensed',sans-serif" }}>{data.project.progress}%</div>
          <div style={{ height: 4, width: 80, background: 'var(--bg4)', borderRadius: 10, marginTop: 4, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${data.project.progress}%`, background: 'var(--amber)', borderRadius: 10 }} />
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 10, marginBottom: 18 }}>
        {[
          { n: openObs, l: 'Obs. ouvertes', c: 'var(--red)', href: 'observations' },
          { n: critObs, l: 'Critiques', c: 'var(--orange)' },
          { n: openRes, l: 'Réserves', c: 'var(--amber)', href: 'reserves' },
          { n: overdue, l: 'Tâches retard', c: 'var(--red)' },
          { n: obs.filter(o => o.status === 'validated').length, l: 'Validées', c: 'var(--green)' },
        ].map((k, i) => (
          <a key={i} href={k.href ? `/project/${projectId}/${k.href}` : undefined} style={{ textDecoration: 'none', display: 'block', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 14px', cursor: k.href ? 'pointer' : 'default' }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: k.c, fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: '-0.5px', lineHeight: 1 }}>{k.n}</div>
            <div style={{ fontSize: 10, color: 'var(--text2)', marginTop: 4, fontFamily: "'Barlow Condensed',sans-serif" }}>{k.l}</div>
          </a>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
        {/* Phases */}
        <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 10, padding: 14 }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text3)', letterSpacing: '1.2px', fontFamily: "'Barlow Condensed',sans-serif", marginBottom: 12 }}>PHASES CHANTIER</div>
          {PHASES.map((ph, i) => {
            const done = i < PHASES.indexOf(data.project.phase); const current = ph === data.project.phase
            return (
              <div key={ph} style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: i < PHASES.length - 1 ? 8 : 0 }}>
                <div style={{ width: 18, height: 18, borderRadius: '50%', background: done ? 'var(--green)' : current ? 'var(--amber)' : 'var(--bg4)', border: `1.5px solid ${done ? 'var(--green)' : current ? 'var(--amber)' : 'var(--border)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 700, color: done || current ? '#0A0B0D' : 'var(--text3)', flexShrink: 0 }}>{done ? '✓' : i + 1}</div>
                <span style={{ flex: 1, fontSize: 12, color: done ? 'var(--text3)' : current ? 'var(--text)' : 'var(--text3)', fontWeight: current ? 600 : 400 }}>{ph}</span>
                {current && <Badge label="EN COURS" color="var(--amber)" bg="rgba(245,166,35,0.1)" small />}
                {done && <Badge label="OK" color="var(--green)" bg="rgba(46,201,114,0.1)" small />}
              </div>
            )
          })}
        </div>

        {/* By intervenant */}
        <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 10, padding: 14 }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text3)', letterSpacing: '1.2px', fontFamily: "'Barlow Condensed',sans-serif", marginBottom: 12 }}>PAR INTERVENANT</div>
          {byIv.length === 0 ? <div style={{ color: 'var(--text3)', fontSize: 12, textAlign: 'center', padding: '20px 0' }}>Aucune observation ouverte</div> :
            byIv.map(iv => (
              <div key={iv.id} style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 10 }}>
                <Avt name={iv.name} color={iv.color} size={22} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, color: 'var(--text)', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{iv.name}</div>
                  <div style={{ fontSize: 10, color: 'var(--text3)' }}>{iv.type}</div>
                </div>
                <div style={{ display: 'flex', gap: 5 }}>
                  {iv.obsCount > 0 && <Badge label={`${iv.obsCount} obs`} color="var(--red)" bg="rgba(232,64,64,0.1)" small />}
                  {iv.resCount > 0 && <Badge label={`${iv.resCount} rés`} color="var(--amber)" bg="rgba(245,166,35,0.1)" small />}
                </div>
              </div>
            ))
          }
        </div>
      </div>

      {/* Recent obs */}
      <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 10, padding: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text3)', letterSpacing: '1.2px', fontFamily: "'Barlow Condensed',sans-serif" }}>OBSERVATIONS RÉCENTES</div>
          <a href={`/project/${projectId}/observations`} style={{ fontSize: 11, color: 'var(--blue)', textDecoration: 'none' }}>Voir tout →</a>
        </div>
        {data.observations.slice(0, 5).map(o => {
          const iv = data.intervenants.find(i => i.id === o.intervenant_id)
          return (
            <div key={o.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '0.5px solid var(--border)' }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: OBS_STATUS_CONFIG[o.status]?.color || '#fff', flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, color: 'var(--text)', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{o.title}</div>
                <div style={{ fontSize: 10, color: 'var(--text3)' }}>{o.zone} · {iv?.name}</div>
              </div>
              <PriorityBadge priority={o.priority} small />
              <StatusBadge status={o.status} small />
            </div>
          )
        })}
        {data.observations.length === 0 && <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text3)', fontSize: 12 }}>Aucune observation</div>}
      </div>
    </div>
  )
}

// ============ PLANS VIEW ============
export function PlansView() {
  const { data, projectId } = useProject()
  const supabase = createClient()
  const router = useRouter()
  const [selectedPlan, setSelectedPlan] = useState(data.plans[0] || null)
  const [showAddObs, setShowAddObs] = useState(false)
  const [clickPos, setClickPos] = useState<{ x: number; y: number } | null>(null)
  const [selectedObs, setSelectedObs] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)

  const obsOnPlan = data.observations.filter(o => o.plan_id === selectedPlan?.id)
  const selObs = selectedObs ? data.observations.find(o => o.id === selectedObs) : null

  function handlePlanClick(e: React.MouseEvent<HTMLDivElement>) {
    if (!showAddObs) return
    const rect = e.currentTarget.getBoundingClientRect()
    const x = Math.round(((e.clientX - rect.left) / rect.width) * 100)
    const y = Math.round(((e.clientY - rect.top) / rect.height) * 100)
    setClickPos({ x, y })
  }

  return (
    <div className="fade-up">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)', fontFamily: "'Barlow Condensed',sans-serif" }}>PLANS & LOCALISATION</h1>
          <p style={{ fontSize: 11, color: 'var(--text2)', marginTop: 2 }}>{data.plans.length} plans · {obsOnPlan.length} observations sur ce plan</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setShowAddObs(!showAddObs)} style={{ padding: '7px 14px', background: showAddObs ? 'var(--amber)' : 'var(--bg3)', border: `1px solid ${showAddObs ? 'var(--amber)' : 'var(--border)'}`, borderRadius: 7, color: showAddObs ? '#0A0B0D' : 'var(--text2)', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: '0.5px' }}>
            {showAddObs ? '✕ ANNULER' : '📍 PLACER OBS'}
          </button>
        </div>
      </div>

      {showAddObs && <div style={{ padding: '7px 12px', background: 'rgba(245,166,35,0.08)', border: '1px solid rgba(245,166,35,0.3)', borderRadius: 6, fontSize: 11, color: 'var(--amber)', marginBottom: 12 }}>Cliquez sur le plan pour placer une observation</div>}

      <div style={{ display: 'grid', gridTemplateColumns: '150px 1fr 250px', gap: 12 }}>
        {/* Plan list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {data.plans.map(plan => (
            <div key={plan.id} onClick={() => setSelectedPlan(plan)} style={{ padding: '9px 11px', background: selectedPlan?.id === plan.id ? 'var(--bg4)' : 'var(--bg3)', border: `1px solid ${selectedPlan?.id === plan.id ? 'var(--amber)' : 'var(--border)'}`, borderRadius: 7, cursor: 'pointer', transition: 'all 0.12s' }}>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 3 }}>📐</div>
              <div style={{ fontSize: 11, color: 'var(--text)', fontWeight: 500, lineHeight: 1.3 }}>{plan.name.split('—')[0].trim()}</div>
              <div style={{ fontSize: 9, color: 'var(--text3)', marginTop: 3 }}>{plan.zone} · {data.observations.filter(o => o.plan_id === plan.id).length} obs</div>
            </div>
          ))}
          {data.plans.length === 0 && <div style={{ padding: 12, fontSize: 11, color: 'var(--text3)', textAlign: 'center' }}>Aucun plan</div>}
          <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px', background: 'none', border: '1px dashed var(--border)', borderRadius: 7, color: 'var(--text3)', fontSize: 11, cursor: 'pointer', textAlign: 'center' }}>
            {uploading ? '...' : '+ Upload'}
            <input type="file" accept=".pdf,image/*" style={{ display: 'none' }} onChange={async (e) => {
              const file = e.target.files?.[0]; if (!file || !selectedPlan) return
              setUploading(true)
              const path = `${projectId}/plans/${Date.now()}_${file.name}`
              await supabase.storage.from('sitepilot-files').upload(path, file)
              const { data: url } = supabase.storage.from('sitepilot-files').getPublicUrl(path)
              await supabase.from('plans').insert({ project_id: projectId, name: file.name, zone: 'Nouveau', file_url: url.publicUrl, file_size: `${(file.size / 1024 / 1024).toFixed(1)} MB` })
              setUploading(false); router.refresh()
            }} />
          </label>
        </div>

        {/* Plan canvas */}
        {selectedPlan && (
          <div onClick={handlePlanClick} style={{ cursor: showAddObs ? 'crosshair' : 'default', position: 'relative', background: '#1A2535', borderRadius: 8, border: '1px solid var(--border)', overflow: 'hidden', paddingBottom: '62%' }}>
            <div style={{ position: 'absolute', inset: 0 }}>
              {[20, 40, 60, 80].map(x => <div key={x} style={{ position: 'absolute', left: `${x}%`, top: 0, bottom: 0, width: 1, background: 'rgba(255,255,255,0.03)' }} />)}
              {[25, 50, 75].map(y => <div key={y} style={{ position: 'absolute', top: `${y}%`, left: 0, right: 0, height: 1, background: 'rgba(255,255,255,0.03)' }} />)}
              <div style={{ position: 'absolute', bottom: 8, right: 8, fontSize: 10, color: 'var(--text3)', fontFamily: 'monospace' }}>N↑</div>
              <div style={{ position: 'absolute', top: 10, left: 12, fontSize: 11, color: 'rgba(245,166,35,0.6)', fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700 }}>{selectedPlan.zone?.toUpperCase()}</div>
              {selectedPlan.file_url && <img src={selectedPlan.file_url} alt={selectedPlan.name} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', opacity: 0.85 }} />}
              {obsOnPlan.map(obs => (
                <div key={obs.id} onClick={e => { e.stopPropagation(); setSelectedObs(obs.id === selectedObs ? null : obs.id) }}
                  style={{ position: 'absolute', left: `${obs.pos_x || 50}%`, top: `${obs.pos_y || 50}%`, transform: 'translate(-50%,-50%)', zIndex: 10, cursor: 'pointer' }}>
                  <div style={{ width: 22, height: 22, borderRadius: '50%', background: OBS_STATUS_CONFIG[obs.status]?.color, border: '2px solid #0A0B0D', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 800, color: '#fff', boxShadow: `0 0 0 3px ${OBS_STATUS_CONFIG[obs.status]?.color}44`, transition: 'transform 0.12s', fontFamily: "'Barlow Condensed',sans-serif" }}
                    onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.3)')}
                    onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
                  >{PRIORITY_CONFIG[obs.priority]?.label[0]}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Sidebar */}
        <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 10, padding: 12, overflow: 'auto' }}>
          {selObs ? (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text3)', fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: '1px' }}>OBSERVATION</div>
                <button onClick={() => setSelectedObs(null)} style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 12 }}>✕</button>
              </div>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text)', marginBottom: 8, lineHeight: 1.3 }}>{selObs.title}</div>
              <div style={{ display: 'flex', gap: 5, marginBottom: 10, flexWrap: 'wrap' }}>
                <PriorityBadge priority={selObs.priority} small />
                <StatusBadge status={selObs.status} small />
              </div>
              {selObs.description && <div style={{ fontSize: 11, color: 'var(--text2)', lineHeight: 1.5, marginBottom: 10 }}>{selObs.description}</div>}
              <div style={{ fontSize: 10, color: 'var(--text3)' }}>Zone: {selObs.zone} · {timeAgo(selObs.created_at)}</div>
            </div>
          ) : (
            <div>
              <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text3)', fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: '1px', marginBottom: 10 }}>OBS SUR CE PLAN</div>
              {obsOnPlan.length === 0 && <div style={{ color: 'var(--text3)', fontSize: 11, textAlign: 'center', padding: '20px 0' }}>Aucune observation</div>}
              {obsOnPlan.map(obs => (
                <div key={obs.id} onClick={() => setSelectedObs(obs.id)} style={{ display: 'flex', gap: 7, padding: '7px 0', borderBottom: '0.5px solid var(--border)', cursor: 'pointer' }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: OBS_STATUS_CONFIG[obs.status]?.color, flexShrink: 0, marginTop: 4 }} />
                  <div>
                    <div style={{ fontSize: 11.5, color: 'var(--text)', fontWeight: 500, lineHeight: 1.3 }}>{obs.title}</div>
                    <PriorityBadge priority={obs.priority} small />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quick obs modal */}
      {clickPos && selectedPlan && (
        <QuickObsModal pos={clickPos} planId={selectedPlan.id} zone={selectedPlan.zone || ''} data={data} projectId={projectId}
          onClose={() => { setClickPos(null); setShowAddObs(false) }}
          onCreated={() => { setClickPos(null); setShowAddObs(false); router.refresh() }} />
      )}
    </div>
  )
}

function QuickObsModal({ pos, planId, zone, data, projectId, onClose, onCreated }: { pos: { x: number; y: number }; planId: string; zone: string; data: ReturnType<typeof useProject>['data']; projectId: string; onClose: () => void; onCreated: () => void }) {
  const supabase = createClient()
  const [title, setTitle] = useState('')
  const [priority, setPriority] = useState<Priority>('high')
  const [ivId, setIvId] = useState(data.intervenants[0]?.id || '')
  const [desc, setDesc] = useState('')
  const [loading, setLoading] = useState(false)

  async function create() {
    if (!title.trim()) return
    setLoading(true)
    const { data: obs, error } = await supabase.from('observations').insert({
      project_id: projectId, plan_id: planId, title: title.trim(), description: desc.trim() || null,
      priority, status: 'open', zone, pos_x: pos.x, pos_y: pos.y,
      intervenant_id: ivId || null, created_by_name: data.currentUser.name,
    }).select().single()
    if (!error && obs) {
      await supabase.from('obs_history').insert({ observation_id: obs.id, action: 'Créée', by_name: data.currentUser.name })
    }
    setLoading(false)
    onCreated()
  }

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose() }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 12, width: 420, padding: 22 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 4, fontFamily: "'Barlow Condensed',sans-serif" }}>📍 NOUVELLE OBSERVATION</div>
        <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 16 }}>X:{pos.x}% Y:{pos.y}% · Zone: {zone}</div>
        <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Titre de l'observation..." autoFocus style={inp({ marginBottom: 10 })} />
        <textarea value={desc} onChange={e => setDesc(e.target.value)} placeholder="Description..." rows={2} style={inp({ resize: 'vertical', marginBottom: 12 })} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
          <div>
            <label style={lbl}>PRIORITÉ</label>
            <div style={{ display: 'flex', gap: 4 }}>
              {(['critical', 'high', 'medium', 'low'] as Priority[]).map(p => {
                const pc = PRIORITY_CONFIG[p]; const sel = priority === p
                return <button key={p} onClick={() => setPriority(p)} style={{ flex: 1, padding: '5px 2px', borderRadius: 5, border: `1px solid ${sel ? pc.color : 'var(--border)'}`, background: sel ? pc.bg : 'var(--bg3)', color: sel ? pc.color : 'var(--text3)', fontSize: 9, cursor: 'pointer', fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700 }}>{pc.label[0]}</button>
              })}
            </div>
          </div>
          <div>
            <label style={lbl}>ENTREPRISE</label>
            <select value={ivId} onChange={e => setIvId(e.target.value)} style={inp({ padding: '6px 8px', fontSize: 11, cursor: 'pointer' })}>
              <option value="">Aucune</option>
              {data.intervenants.map(iv => <option key={iv.id} value={iv.id}>{iv.name}</option>)}
            </select>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={create} disabled={!title.trim() || loading} style={{ flex: 1, padding: '10px', background: title.trim() && !loading ? 'var(--amber)' : 'var(--bg4)', border: 'none', borderRadius: 8, color: title.trim() && !loading ? '#0A0B0D' : 'var(--text3)', fontSize: 12, fontWeight: 800, cursor: title.trim() && !loading ? 'pointer' : 'not-allowed', fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: '1px' }}>
            {loading ? 'CRÉATION...' : 'CRÉER'}
          </button>
          <button onClick={onClose} style={{ padding: '10px 16px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text2)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>Annuler</button>
        </div>
      </div>
    </div>
  )
}

// ============ OBSERVATIONS VIEW ============
export function ObservationsView() {
  const { data, projectId } = useProject()
  const supabase = createClient()
  const router = useRouter()
  const [filter, setFilter] = useState<ObsStatus | 'all'>('all')
  const [fp, setFp] = useState<Priority | ''>('')
  const [selected, setSelected] = useState<string | null>(null)
  const [comment, setComment] = useState('')

  const filtered = data.observations.filter(o => {
    if (filter !== 'all' && o.status !== filter) return false
    if (fp && o.priority !== fp) return false
    return true
  })
  const sel = selected ? data.observations.find(o => o.id === selected) : null

  async function addComment() {
    if (!comment.trim() || !sel) return
    await supabase.from('obs_comments').insert({ observation_id: sel.id, author_name: data.currentUser.name, author_id: data.currentUser.id, content: comment.trim() })
    setComment('')
    router.refresh()
  }

  async function updateStatus(obsId: string, status: ObsStatus) {
    await supabase.from('observations').update({ status }).eq('id', obsId)
    await supabase.from('obs_history').insert({ observation_id: obsId, action: OBS_STATUS_CONFIG[status].label, by_name: data.currentUser.name })
    router.refresh()
  }

  return (
    <div className="fade-up" style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 360px' : '1fr', gap: 14, height: 'calc(100vh - 110px)' }}>
      <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexShrink: 0 }}>
          <div>
            <h1 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)', fontFamily: "'Barlow Condensed',sans-serif" }}>OBSERVATIONS TERRAIN</h1>
            <p style={{ fontSize: 11, color: 'var(--text2)', marginTop: 2 }}>{filtered.length} observation{filtered.length !== 1 ? 's' : ''}</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <select value={fp} onChange={e => setFp(e.target.value as Priority | '')} style={inp({ width: 'auto', padding: '5px 9px', fontSize: 11, cursor: 'pointer' })}>
              <option value="">Priorité</option>
              {(['critical', 'high', 'medium', 'low'] as Priority[]).map(p => <option key={p} value={p}>{PRIORITY_CONFIG[p].label}</option>)}
            </select>
          </div>
        </div>

        {/* Status tabs */}
        <div style={{ display: 'flex', gap: 3, marginBottom: 12, background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 7, padding: 3, width: 'fit-content', flexShrink: 0 }}>
          {(['all', 'open', 'progress', 'corrected', 'validated'] as const).map(k => (
            <button key={k} onClick={() => setFilter(k)} style={{ padding: '4px 12px', borderRadius: 5, fontSize: 11, fontWeight: filter === k ? 700 : 400, cursor: 'pointer', border: 'none', background: filter === k ? 'var(--bg4)' : 'transparent', color: filter === k ? 'var(--text)' : 'var(--text3)', fontFamily: 'inherit' }}>
              {k === 'all' ? 'Toutes' : OBS_STATUS_CONFIG[k].label}
            </button>
          ))}
        </div>

        <div style={{ overflowY: 'auto', flex: 1 }}>
          {filtered.map(obs => {
            const iv = data.intervenants.find(i => i.id === obs.intervenant_id)
            return (
              <div key={obs.id} onClick={() => setSelected(obs.id === selected ? null : obs.id)} style={{ display: 'flex', gap: 10, padding: '11px 13px', background: selected === obs.id ? 'var(--bg4)' : 'var(--bg3)', border: `1px solid ${selected === obs.id ? 'var(--amber)' : 'var(--border)'}`, borderRadius: 9, marginBottom: 7, cursor: 'pointer', transition: 'all 0.12s' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, flexShrink: 0 }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: OBS_STATUS_CONFIG[obs.status]?.color }} />
                  {(obs.photos?.length || 0) > 0 && <div style={{ fontSize: 9 }}>📷</div>}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 4 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{obs.title}</div>
                    <PriorityBadge priority={obs.priority} small />
                    <StatusBadge status={obs.status} small />
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text3)', display: 'flex', gap: 8 }}>
                    {obs.zone && <span>📍 {obs.zone}</span>}
                    {iv && <span style={{ color: iv.color }}>· {iv.name}</span>}
                    <span>· {timeAgo(obs.created_at)}</span>
                    {(obs.comments?.length || 0) > 0 && <span>· 💬 {obs.comments!.length}</span>}
                  </div>
                </div>
              </div>
            )
          })}
          {filtered.length === 0 && <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text3)' }}><div style={{ fontSize: 30, marginBottom: 10 }}>👁</div><div style={{ fontSize: 13 }}>Aucune observation</div></div>}
        </div>
      </div>

      {sel && (
        <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 12, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: OBS_STATUS_CONFIG[sel.status]?.color }} />
            <div style={{ flex: 1, fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{sel.title}</div>
            <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 13 }}>✕</button>
          </div>
          <div style={{ padding: '12px 14px', overflowY: 'auto', flex: 1 }}>
            <div style={{ display: 'flex', gap: 5, marginBottom: 12, flexWrap: 'wrap' }}>
              <PriorityBadge priority={sel.priority} />
              <StatusBadge status={sel.status} />
            </div>
            {(sel.photos?.length || 0) > 0 && (
              <div style={{ background: 'var(--bg4)', borderRadius: 8, height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12, border: '1px solid var(--border)', cursor: 'pointer', overflow: 'hidden', position: 'relative' }}>
                {sel.photos![0]?.url ? <img src={sel.photos![0].url} alt="photo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ textAlign: 'center' }}><div style={{ fontSize: 24, marginBottom: 4 }}>📸</div><div style={{ fontSize: 10, color: 'var(--text2)' }}>{sel.photos!.length} photo{sel.photos!.length > 1 ? 's' : ''}</div></div>}
              </div>
            )}
            {(sel.photos?.length || 0) === 0 && (
              <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--bg4)', border: '1px dashed var(--border)', borderRadius: 8, height: 80, marginBottom: 12, cursor: 'pointer' }}>
                <div style={{ fontSize: 16, marginBottom: 3 }}>📷</div>
                <div style={{ fontSize: 10, color: 'var(--text3)' }}>Ajouter une photo</div>
                <input type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={async e => {
                  const file = e.target.files?.[0]; if (!file) return
                  const path = `${projectId}/obs/${sel.id}/${Date.now()}_${file.name}`
                  await supabase.storage.from('sitepilot-files').upload(path, file)
                  const { data: url } = supabase.storage.from('sitepilot-files').getPublicUrl(path)
                  await supabase.from('obs_photos').insert({ observation_id: sel.id, url: url.publicUrl })
                  router.refresh()
                }} />
              </label>
            )}
            {sel.description && <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 12, lineHeight: 1.5 }}>{sel.description}</div>}
            {[{ l: 'Zone', v: sel.zone }, { l: 'Créée par', v: sel.created_by_name }, { l: 'Date', v: fmtDate(sel.created_at) }].map(({ l, v }) => (
              <div key={l} style={{ display: 'flex', padding: '5px 0', borderBottom: '0.5px solid var(--border)' }}>
                <div style={{ width: 80, fontSize: 10, color: 'var(--text3)' }}>{l}</div>
                <div style={{ fontSize: 11, color: 'var(--text)' }}>{v || '—'}</div>
              </div>
            ))}
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text3)', fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: '1px', marginBottom: 7 }}>STATUT</div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {(['open', 'progress', 'corrected', 'validated'] as ObsStatus[]).map(k => (
                  <button key={k} onClick={() => updateStatus(sel.id, k)} style={{ padding: '3px 9px', borderRadius: 4, border: `1px solid ${sel.status === k ? OBS_STATUS_CONFIG[k].color : 'var(--border)'}`, background: sel.status === k ? `${OBS_STATUS_CONFIG[k].color}15` : 'var(--bg4)', color: sel.status === k ? OBS_STATUS_CONFIG[k].color : 'var(--text3)', fontSize: 10, cursor: 'pointer', fontFamily: "'Barlow Condensed',sans-serif", fontWeight: sel.status === k ? 700 : 400 }}>{OBS_STATUS_CONFIG[k].label}</button>
                ))}
              </div>
            </div>
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text3)', fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: '1px', marginBottom: 9 }}>HISTORIQUE</div>
              {(sel.history || []).map((h: ObsHistory, i: number) => (
                <div key={i} style={{ display: 'flex', gap: 8, paddingBottom: 9 }}>
                  <div style={{ width: 14, height: 14, borderRadius: '50%', background: 'var(--bg4)', border: '1px solid var(--border)', flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text2)' }}><strong style={{ color: 'var(--text)' }}>{h.action}</strong> par {h.by_name}</div>
                    {h.note && <div style={{ fontSize: 10, color: 'var(--text3)' }}>"{h.note}"</div>}
                    <div style={{ fontSize: 9, color: 'var(--text3)' }}>{timeAgo(h.created_at)}</div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text3)', fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: '1px', marginBottom: 9 }}>COMMENTAIRES ({(sel.comments || []).length})</div>
              {(sel.comments || []).map((c: { id?: string; author_name: string; content: string; created_at: string }) => (
                <div key={c.id || c.created_at} style={{ display: 'flex', gap: 7, marginBottom: 9 }}>
                  <Avt name={c.author_name} size={20} />
                  <div style={{ background: 'var(--bg4)', borderRadius: 6, padding: '6px 9px', flex: 1 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text)', marginBottom: 3 }}>{c.author_name} <span style={{ color: 'var(--text3)', fontWeight: 400 }}>· {timeAgo(c.created_at)}</span></div>
                    <div style={{ fontSize: 11, color: 'var(--text2)', lineHeight: 1.4 }}>{c.content}</div>
                  </div>
                </div>
              ))}
              <div style={{ display: 'flex', gap: 7, marginTop: 8 }}>
                <input value={comment} onChange={e => setComment(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && comment.trim()) addComment() }} placeholder="Commenter..." style={inp({ flex: 1, padding: '6px 9px', fontSize: 11 })} />
                <button onClick={addComment} style={{ padding: '6px 12px', background: 'var(--blue)', border: 'none', borderRadius: 6, color: '#fff', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>↵</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ============ RESERVES VIEW ============
export function ReservesView() {
  const { data, projectId } = useProject()
  const supabase = createClient()
  const router = useRouter()
  const [filter, setFilter] = useState<ObsStatus | 'all'>('all')
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ title: '', desc: '', priority: 'high' as Priority, ivId: '', zone: '' })

  const filtered = data.reserves.filter(r => filter === 'all' || r.status === filter)
  const counts = { open: data.reserves.filter(r => r.status === 'open').length, progress: data.reserves.filter(r => r.status === 'progress').length, corrected: data.reserves.filter(r => r.status === 'corrected').length, validated: data.reserves.filter(r => r.status === 'validated').length }

  async function create() {
    if (!form.title.trim()) return
    await supabase.from('reserves').insert({ project_id: projectId, title: form.title.trim(), description: form.desc.trim() || null, priority: form.priority, status: 'open', zone: form.zone || null, intervenant_id: form.ivId || null, created_by: data.currentUser.id })
    setShowCreate(false); setForm({ title: '', desc: '', priority: 'high', ivId: '', zone: '' })
    router.refresh()
  }

  async function updateStatus(id: string, status: ObsStatus) {
    await supabase.from('reserves').update({ status }).eq('id', id)
    router.refresh()
  }

  return (
    <div className="fade-up">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div><h1 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)', fontFamily: "'Barlow Condensed',sans-serif" }}>RÉSERVES CHANTIER</h1><p style={{ fontSize: 11, color: 'var(--text2)', marginTop: 2 }}>{data.reserves.length} réserves</p></div>
        <button onClick={() => setShowCreate(!showCreate)} style={{ padding: '7px 14px', background: 'var(--orange)', border: 'none', borderRadius: 7, color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: '0.5px' }}>🚩 NOUVELLE RÉSERVE</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 9, marginBottom: 16 }}>
        {(['open', 'progress', 'corrected', 'validated'] as ObsStatus[]).map(k => (
          <div key={k} onClick={() => setFilter(k === filter ? 'all' : k)} style={{ background: 'var(--bg3)', border: `1px solid ${filter === k ? OBS_STATUS_CONFIG[k].color : 'var(--border)'}`, borderRadius: 7, padding: '10px 13px', cursor: 'pointer', transition: 'all 0.12s' }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: OBS_STATUS_CONFIG[k].color, fontFamily: "'Barlow Condensed',sans-serif" }}>{counts[k]}</div>
            <div style={{ fontSize: 10, color: 'var(--text2)', fontFamily: "'Barlow Condensed',sans-serif" }}>{OBS_STATUS_CONFIG[k].label}</div>
          </div>
        ))}
      </div>

      {showCreate && (
        <div style={{ background: 'var(--bg3)', border: '1px solid rgba(240,112,64,0.3)', borderRadius: 10, padding: 16, marginBottom: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9, marginBottom: 9 }}>
            <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Titre de la réserve..." autoFocus style={inp()} />
            <input value={form.zone} onChange={e => setForm({ ...form, zone: e.target.value })} placeholder="Zone (RDC, R+2...)" style={inp()} />
          </div>
          <textarea value={form.desc} onChange={e => setForm({ ...form, desc: e.target.value })} placeholder="Description..." rows={2} style={inp({ resize: 'vertical', marginBottom: 9 })} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9, marginBottom: 12 }}>
            <select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value as Priority })} style={inp({ cursor: 'pointer' })}>
              {(['critical', 'high', 'medium', 'low'] as Priority[]).map(p => <option key={p} value={p}>{PRIORITY_CONFIG[p].label}</option>)}
            </select>
            <select value={form.ivId} onChange={e => setForm({ ...form, ivId: e.target.value })} style={inp({ cursor: 'pointer' })}>
              <option value="">Aucune entreprise</option>
              {data.intervenants.map(iv => <option key={iv.id} value={iv.id}>{iv.name}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={create} disabled={!form.title.trim()} style={{ padding: '8px 18px', background: form.title.trim() ? 'var(--orange)' : 'var(--bg4)', border: 'none', borderRadius: 7, color: form.title.trim() ? '#fff' : 'var(--text3)', fontSize: 11, fontWeight: 700, cursor: form.title.trim() ? 'pointer' : 'not-allowed', fontFamily: "'Barlow Condensed',sans-serif" }}>CRÉER</button>
            <button onClick={() => setShowCreate(false)} style={{ padding: '8px 14px', background: 'var(--bg4)', border: '1px solid var(--border)', borderRadius: 7, color: 'var(--text2)', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>Annuler</button>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        {filtered.map(r => {
          const iv = data.intervenants.find(i => i.id === r.intervenant_id)
          const nextStatus: ObsStatus | null = r.status === 'open' ? 'progress' : r.status === 'progress' ? 'corrected' : r.status === 'corrected' ? 'validated' : null
          return (
            <div key={r.id} style={{ display: 'flex', gap: 10, padding: '13px 15px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 9, transition: 'all 0.12s' }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = OBS_STATUS_CONFIG[r.status].color)}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
            >
              <div style={{ flexShrink: 0, marginTop: 2 }}>🚩</div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 5 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', flex: 1 }}>{r.title}</div>
                  <PriorityBadge priority={r.priority} small />
                  <StatusBadge status={r.status} small />
                </div>
                {r.description && <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 5, lineHeight: 1.4 }}>{r.description}</div>}
                <div style={{ display: 'flex', gap: 10, fontSize: 10, color: 'var(--text3)' }}>
                  {r.zone && <span>📍 {r.zone}</span>}
                  {iv && <span style={{ color: iv.color }}>🏢 {iv.name}</span>}
                  <span>📅 {fmtDate(r.created_at)}</span>
                </div>
              </div>
              {nextStatus && (
                <button onClick={() => updateStatus(r.id, nextStatus)} style={{ padding: '5px 10px', background: 'var(--bg4)', border: `1px solid var(--border)`, borderRadius: 5, color: OBS_STATUS_CONFIG[nextStatus].color, fontSize: 10, cursor: 'pointer', fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700, whiteSpace: 'nowrap', alignSelf: 'center' }}>→ {OBS_STATUS_CONFIG[nextStatus].label}</button>
              )}
            </div>
          )
        })}
        {filtered.length === 0 && <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text3)' }}><div style={{ fontSize: 30, marginBottom: 10 }}>🚩</div><div style={{ fontSize: 13 }}>Aucune réserve</div></div>}
      </div>
    </div>
  )
}

// ============ TASKS VIEW ============
export function TasksView() {
  const { data, projectId, showToast } = useProject()
  const supabase = createClient()
  const router = useRouter()
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ title: '', priority: 'medium' as Priority, ivId: '', dueDate: '', desc: '' })
  const [busy, setBusy] = useState(false)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Les erreurs Supabase (RLS, session expirée, réseau) étaient ignorées :
  // le bouton ne produisait aucun effet visible et la tâche semblait perdue.
  // Elles sont désormais remontées à l'utilisateur.
  async function create() {
    if (!form.title.trim() || busy) return
    setBusy(true); setError(null)
    const { error: err } = await supabase.from('tasks').insert({
      project_id: projectId,
      title: form.title.trim(),
      priority: form.priority,
      status: 'pending',
      assignee_id: form.ivId || null,
      due_date: form.dueDate || null,
      description: form.desc.trim() || null,
      created_by: data.currentUser.id,
    })
    setBusy(false)
    if (err) { setError(`Création impossible : ${err.message}`); return }
    setShowCreate(false)
    setForm({ title: '', priority: 'medium', ivId: '', dueDate: '', desc: '' })
    showToast('Tâche créée')
    router.refresh()
  }

  async function updateStatus(id: string, status: string) {
    if (pendingId) return
    setPendingId(id); setError(null)
    const { error: err } = await supabase.from('tasks').update({ status }).eq('id', id)
    setPendingId(null)
    if (err) { setError(`Mise à jour impossible : ${err.message}`); return }
    showToast(status === 'done' ? 'Tâche terminée' : 'Tâche démarrée')
    router.refresh()
  }

  const byStatus = { pending: data.tasks.filter(t => t.status === 'pending'), in_progress: data.tasks.filter(t => t.status === 'in_progress'), done: data.tasks.filter(t => t.status === 'done') }

  return (
    <div className="fade-up">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div><h1 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)', fontFamily: "'Barlow Condensed',sans-serif" }}>TÂCHES CHANTIER</h1><p style={{ fontSize: 11, color: 'var(--text2)', marginTop: 2 }}>{data.tasks.length} tâches</p></div>
        <button onClick={() => setShowCreate(!showCreate)} style={{ padding: '7px 14px', background: 'var(--blue)', border: 'none', borderRadius: 7, color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: "'Barlow Condensed',sans-serif" }}>+ NOUVELLE TÂCHE</button>
      </div>

      {showCreate && (
        <div style={{ background: 'var(--bg3)', border: '1px solid rgba(61,142,240,0.3)', borderRadius: 10, padding: 16, marginBottom: 14 }}>
          <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Titre de la tâche..." autoFocus style={inp({ marginBottom: 9 })} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 9 }}>
            <select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value as Priority })} style={inp({ cursor: 'pointer' })}>
              {(['critical', 'high', 'medium', 'low'] as Priority[]).map(p => <option key={p} value={p}>{PRIORITY_CONFIG[p].label}</option>)}
            </select>
            <select value={form.ivId} onChange={e => setForm({ ...form, ivId: e.target.value })} style={inp({ cursor: 'pointer' })}>
              <option value="">Assigner à...</option>
              {data.intervenants.map(iv => <option key={iv.id} value={iv.id}>{iv.name}</option>)}
            </select>
            <input type="date" value={form.dueDate} onChange={e => setForm({ ...form, dueDate: e.target.value })} style={inp()} />
          </div>
          <textarea value={form.desc} onChange={e => setForm({ ...form, desc: e.target.value })} placeholder="Description (facultatif)..." rows={2} style={inp({ marginBottom: 9, resize: 'vertical' })} />
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={create} disabled={!form.title.trim() || busy} style={{ padding: '8px 18px', background: form.title.trim() && !busy ? 'var(--blue)' : 'var(--bg4)', border: 'none', borderRadius: 7, color: form.title.trim() && !busy ? '#fff' : 'var(--text3)', fontSize: 11, fontWeight: 700, cursor: form.title.trim() && !busy ? 'pointer' : 'not-allowed', fontFamily: "'Barlow Condensed',sans-serif" }}>{busy ? 'CRÉATION...' : 'CRÉER'}</button>
            <button onClick={() => setShowCreate(false)} style={{ padding: '8px 14px', background: 'var(--bg4)', border: '1px solid var(--border)', borderRadius: 7, color: 'var(--text2)', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>Annuler</button>
          </div>
        </div>
      )}

      {error && (
        <div style={{ padding: '9px 12px', background: 'rgba(232,64,64,0.1)', border: '1px solid rgba(232,64,64,0.3)', borderRadius: 7, fontSize: 11, color: 'var(--red)', marginBottom: 12 }}>
          {error}
        </div>
      )}

      {data.tasks.length === 0 && !showCreate && (
        <div style={{ textAlign: 'center', padding: '40px 20px', border: '1px dashed var(--border)', borderRadius: 10, color: 'var(--text3)', marginBottom: 14 }}>
          <div style={{ fontSize: 28, marginBottom: 10 }}>✓</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text2)', fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: '0.5px' }}>AUCUNE TÂCHE</div>
          <div style={{ fontSize: 11, marginTop: 4 }}>Créez la première tâche du chantier.</div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
        {([['pending', 'EN ATTENTE', 'var(--text3)'], ['in_progress', 'EN COURS', 'var(--amber)'], ['done', 'TERMINÉES', 'var(--green)']] as const).map(([s, l, c]) => (
          <div key={s} style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
            <div style={{ padding: '9px 13px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: c, fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: '1px' }}>{l}</span>
              <span style={{ background: 'var(--bg4)', borderRadius: 4, padding: '1px 6px', fontSize: 10, color: 'var(--text3)' }}>{byStatus[s].length}</span>
            </div>
            {byStatus[s].map(task => {
              const iv = data.intervenants.find(i => i.id === task.assignee_id)
              const isOD = task.due_date && new Date(task.due_date) < new Date() && task.status !== 'done'
              const linkedObs = task.obs_id ? data.observations.find(o => o.id === task.obs_id) : null
              return (
                <div key={task.id} style={{ padding: '10px 13px', borderBottom: '0.5px solid var(--border)' }}>
                  <div style={{ display: 'flex', gap: 5, marginBottom: 5 }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: PRIORITY_CONFIG[task.priority]?.color, flexShrink: 0, marginTop: 5 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', lineHeight: 1.35, marginBottom: 4 }}>{task.title}</div>
                      {linkedObs && <div style={{ fontSize: 9, color: 'var(--orange)', marginBottom: 4 }}>🔗 {linkedObs.title.slice(0, 28)}...</div>}
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {iv && <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Avt name={iv.name} color={iv.color} size={13} /><span style={{ fontSize: 10, color: 'var(--text3)' }}>{iv.name.split(' ')[0]}</span></div>}
                        {task.due_date && <span style={{ fontSize: 10, color: isOD ? 'var(--red)' : 'var(--text3)' }}>{isOD ? '⚠️ ' : ''}{fmtDate(task.due_date)}</span>}
                      </div>
                    </div>
                  </div>
                  {task.status !== 'done' && (
                    <button onClick={() => updateStatus(task.id, task.status === 'pending' ? 'in_progress' : 'done')} disabled={pendingId === task.id} style={{ width: '100%', padding: '4px', background: task.status === 'pending' ? 'rgba(245,166,35,0.08)' : 'rgba(46,201,114,0.08)', border: `1px solid ${task.status === 'pending' ? 'rgba(245,166,35,0.25)' : 'rgba(46,201,114,0.25)'}`, borderRadius: 5, color: task.status === 'pending' ? 'var(--amber)' : 'var(--green)', fontSize: 9, cursor: pendingId === task.id ? 'wait' : 'pointer', opacity: pendingId === task.id ? 0.5 : 1, fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700, marginTop: 4 }}>
                      {pendingId === task.id ? '...' : task.status === 'pending' ? 'DÉMARRER' : 'TERMINER'}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

// ============ DOCUMENTS VIEW ============
export function DocumentsView() {
  const { data, projectId } = useProject()
  const supabase = createClient()
  const router = useRouter()
  const [filter, setFilter] = useState('all')
  const [uploading, setUploading] = useState(false)

  const DOC_TYPES: Record<string, string> = { plan: '📐 Plan', doe: '📁 DOE', contract: '📝 Contrat', report: '📊 Rapport', photo: '📷 Photo' }
  const filtered = data.documents.filter(d => filter === 'all' || d.type === filter)

  return (
    <div className="fade-up">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div><h1 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)', fontFamily: "'Barlow Condensed',sans-serif" }}>DOCUMENTS PROJET</h1><p style={{ fontSize: 11, color: 'var(--text2)', marginTop: 2 }}>{data.documents.length} fichiers</p></div>
        <label style={{ padding: '7px 14px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 7, color: 'var(--text2)', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: '0.5px' }}>
          {uploading ? 'UPLOAD...' : '+ UPLOAD'}
          <input type="file" style={{ display: 'none' }} onChange={async e => {
            const file = e.target.files?.[0]; if (!file) return
            setUploading(true)
            const path = `${projectId}/docs/${Date.now()}_${file.name}`
            await supabase.storage.from('sitepilot-files').upload(path, file)
            const { data: url } = supabase.storage.from('sitepilot-files').getPublicUrl(path)
            const ext = file.name.split('.').pop()?.toLowerCase() || ''
            const type = ext === 'pdf' ? 'report' : ['jpg', 'jpeg', 'png', 'webp'].includes(ext) ? 'photo' : 'report'
            await supabase.from('documents').insert({ project_id: projectId, name: file.name, type, file_url: url.publicUrl, file_size: `${(file.size / 1024 / 1024).toFixed(1)} MB`, uploader_name: data.currentUser.name })
            setUploading(false); router.refresh()
          }} />
        </label>
      </div>

      <div style={{ display: 'flex', gap: 5, marginBottom: 14, flexWrap: 'wrap' }}>
        {[['all', 'Tous'], ['plan', 'Plans'], ['doe', 'DOE'], ['contract', 'Contrats'], ['report', 'Rapports'], ['photo', 'Photos']].map(([k, l]) => (
          <button key={k} onClick={() => setFilter(k)} style={{ padding: '5px 11px', borderRadius: 5, fontSize: 11, cursor: 'pointer', border: `1px solid ${filter === k ? 'var(--blue)' : 'var(--border)'}`, background: filter === k ? 'rgba(61,142,240,0.08)' : 'var(--bg3)', color: filter === k ? 'var(--blue)' : 'var(--text2)', fontFamily: "'Barlow Condensed',sans-serif", fontWeight: filter === k ? 700 : 400 }}>{l}</button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(230px,1fr))', gap: 10 }}>
        {filtered.map(doc => (
          <a key={doc.id} href={doc.file_url || '#'} target="_blank" rel="noreferrer" style={{ textDecoration: 'none', display: 'block', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 9, padding: 13, cursor: 'pointer', transition: 'all 0.12s' }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--blue)')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
          >
            <div style={{ fontSize: 22, marginBottom: 9 }}>{DOC_TYPES[doc.type]?.split(' ')[0] || '📄'}</div>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text)', marginBottom: 3, lineHeight: 1.3 }}>{doc.name}</div>
            <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 8 }}>{doc.uploader_name} · {doc.version}</div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Badge label={DOC_TYPES[doc.type]?.split(' ')[1] || doc.type} color="var(--blue)" bg="rgba(61,142,240,0.1)" small />
              <span style={{ fontSize: 10, color: 'var(--text3)' }}>{doc.file_size} · {fmtDate(doc.uploaded_at)}</span>
            </div>
          </a>
        ))}
        {filtered.length === 0 && <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text3)', gridColumn: '1/-1' }}><div style={{ fontSize: 30, marginBottom: 10 }}>📁</div><div style={{ fontSize: 13 }}>Aucun document</div></div>}
      </div>
    </div>
  )
}

// ============ INTERVENANTS VIEW ============
export function IntervenantsView() {
  const { data, projectId } = useProject()
  const supabase = createClient()
  const router = useRouter()
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ name: '', type: 'Entreprise générale', contact: '', email: '', phone: '' })

  async function create() {
    if (!form.name.trim()) return
    const colors = ['#3D8EF0', '#2EC972', '#F07040', '#8B5CF6', '#F5A623', '#E84040']
    await supabase.from('intervenants').insert({ project_id: projectId, name: form.name.trim(), type: form.type, contact: form.contact || null, email: form.email || null, phone: form.phone || null, color: colors[data.intervenants.length % colors.length] })
    setShowCreate(false); setForm({ name: '', type: 'Entreprise générale', contact: '', email: '', phone: '' }); router.refresh()
  }

  return (
    <div className="fade-up">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div><h1 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)', fontFamily: "'Barlow Condensed',sans-serif" }}>INTERVENANTS</h1><p style={{ fontSize: 11, color: 'var(--text2)', marginTop: 2 }}>{data.intervenants.length} acteurs</p></div>
        <button onClick={() => setShowCreate(!showCreate)} style={{ padding: '7px 14px', background: 'var(--purple)', border: 'none', borderRadius: 7, color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: "'Barlow Condensed',sans-serif" }}>+ INTERVENANT</button>
      </div>

      {showCreate && (
        <div style={{ background: 'var(--bg3)', border: '1px solid rgba(139,92,246,0.3)', borderRadius: 10, padding: 16, marginBottom: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9, marginBottom: 9 }}>
            <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Nom entreprise..." autoFocus style={inp()} />
            <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} style={inp({ cursor: 'pointer' })}>
              {INTERVENANT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 9, marginBottom: 12 }}>
            <input value={form.contact} onChange={e => setForm({ ...form, contact: e.target.value })} placeholder="Contact" style={inp()} />
            <input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="Email" type="email" style={inp()} />
            <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="Téléphone" style={inp()} />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={create} disabled={!form.name.trim()} style={{ padding: '8px 18px', background: form.name.trim() ? 'var(--purple)' : 'var(--bg4)', border: 'none', borderRadius: 7, color: form.name.trim() ? '#fff' : 'var(--text3)', fontSize: 11, fontWeight: 700, cursor: form.name.trim() ? 'pointer' : 'not-allowed', fontFamily: "'Barlow Condensed',sans-serif" }}>CRÉER</button>
            <button onClick={() => setShowCreate(false)} style={{ padding: '8px 14px', background: 'var(--bg4)', border: '1px solid var(--border)', borderRadius: 7, color: 'var(--text2)', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>Annuler</button>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(270px,1fr))', gap: 12 }}>
        {data.intervenants.map(iv => {
          const ivObs = data.observations.filter(o => o.intervenant_id === iv.id)
          const ivRes = data.reserves.filter(r => r.intervenant_id === iv.id)
          const ivTasks = data.tasks.filter(t => t.assignee_id === iv.id)
          return (
            <div key={iv.id} style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 10, padding: 15, transition: 'all 0.12s' }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = iv.color)}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
            >
              <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
                <Avt name={iv.name} color={iv.color} size={36} />
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)' }}>{iv.name}</div>
                  <div style={{ fontSize: 10, color: iv.color, fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700 }}>{iv.type.toUpperCase()}</div>
                  {iv.contact && <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>{iv.contact}</div>}
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 5, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
                {[{ n: ivTasks.length, l: 'Tâches' }, { n: ivObs.length, l: 'Obs.' }, { n: ivRes.length, l: 'Réserves' }].map((s, j) => (
                  <div key={j} style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: s.n > 0 ? iv.color : 'var(--text3)', fontFamily: "'Barlow Condensed',sans-serif" }}>{s.n}</div>
                    <div style={{ fontSize: 9, color: 'var(--text3)', fontFamily: "'Barlow Condensed',sans-serif" }}>{s.l}</div>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
        {data.intervenants.length === 0 && <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text3)', gridColumn: '1/-1' }}><div style={{ fontSize: 30, marginBottom: 10 }}>👷</div><div style={{ fontSize: 13 }}>Aucun intervenant</div></div>}
      </div>
    </div>
  )
}

// ============ CHECKLISTS VIEW ============
export function ChecklistsView() {
  const { data, projectId } = useProject()
  const supabase = createClient()
  const router = useRouter()

  async function toggleItem(itemId: string, done: boolean) {
    await supabase.from('checklist_items').update({ done: !done, done_at: !done ? new Date().toISOString() : null }).eq('id', itemId)
    router.refresh()
  }

  return (
    <div className="fade-up">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
        <div><h1 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)', fontFamily: "'Barlow Condensed',sans-serif" }}>CHECKLISTS TERRAIN</h1><p style={{ fontSize: 11, color: 'var(--text2)', marginTop: 2 }}>{data.checklists.length} formulaires</p></div>
        <button style={{ padding: '7px 14px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 7, color: 'var(--text2)', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: "'Barlow Condensed',sans-serif" }}>+ CHECKLIST</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {data.checklists.map(cl => {
          const items = cl.items || []
          const done = items.filter((i: { done: boolean }) => i.done).length
          const total = items.length
          const pct = total > 0 ? Math.round((done / total) * 100) : 0
          const iv = data.intervenants.find(i => i.id === cl.assigned_to)
          return (
            <div key={cl.id} style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 10, padding: 15 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text)' }}>{cl.name}</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: pct === 100 ? 'var(--green)' : pct > 50 ? 'var(--amber)' : 'var(--red)', fontFamily: "'Barlow Condensed',sans-serif" }}>{pct}%</div>
              </div>
              <div style={{ height: 4, background: 'var(--bg4)', borderRadius: 10, marginBottom: 12, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${pct}%`, background: pct === 100 ? 'var(--green)' : pct > 50 ? 'var(--amber)' : 'var(--red)', borderRadius: 10, transition: 'width 0.4s' }} />
              </div>
              {iv && <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 5 }}><Avt name={iv.name} color={iv.color} size={14} />{iv.name}</div>}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {items.map((item: { id: string; text: string; done: boolean }) => (
                  <div key={item.id} onClick={() => toggleItem(item.id, item.done)} style={{ display: 'flex', alignItems: 'center', gap: 9, cursor: 'pointer' }}>
                    <div style={{ width: 15, height: 15, borderRadius: 3, border: `1.5px solid ${item.done ? 'var(--green)' : 'var(--border)'}`, background: item.done ? 'var(--green)' : 'var(--bg4)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.12s' }}>
                      {item.done && <span style={{ fontSize: 9, color: '#0A0B0D', fontWeight: 800 }}>✓</span>}
                    </div>
                    <span style={{ fontSize: 12, color: item.done ? 'var(--text3)' : 'var(--text)', textDecoration: item.done ? 'line-through' : 'none' }}>{item.text}</span>
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 10 }}>{done}/{total} items · {fmtDate(cl.created_at)}</div>
            </div>
          )
        })}
        {data.checklists.length === 0 && <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text3)', gridColumn: '1/-1' }}><div style={{ fontSize: 30, marginBottom: 10 }}>☑</div><div style={{ fontSize: 13 }}>Aucune checklist</div></div>}
      </div>
    </div>
  )
}
