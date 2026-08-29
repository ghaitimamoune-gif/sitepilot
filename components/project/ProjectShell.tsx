'use client'

import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import type { Observation, Reserve, Task, Intervenant, Checklist } from '@/types'

// ============ CONTEXT ============
interface ProjectData {
  project: { id: string; name: string; address: string; phase: string; progress: number; description: string }
  intervenants: Intervenant[]
  plans: Array<{ id: string; name: string; zone: string; file_url?: string; file_size?: string; version: string; uploaded_at: string }>
  observations: Observation[]
  reserves: Reserve[]
  tasks: Task[]
  documents: Array<{ id: string; name: string; type: string; file_url?: string; file_size?: string; version: string; uploader_name?: string; uploaded_at: string }>
  checklists: Checklist[]
  notifications: Array<{ id: string; type: string; title: string; message: string; is_read: boolean; created_at: string }>
  currentUser: { id: string; email: string; name: string; role: string }
}

interface ProjectCtxValue {
  data: ProjectData
  projectId: string
  refresh: () => void
  showToast: (msg: string) => void
}

const ProjectCtx = createContext<ProjectCtxValue | null>(null)

export function useProject(): ProjectCtxValue {
  const ctx = useContext(ProjectCtx)
  if (!ctx) {
    throw new Error(
      'useProject() doit être appelé dans un <ProjectShell>. ' +
        'Vérifiez que la page se trouve sous app/project/[projectId]/.'
    )
  }
  return ctx
}

// ============ NAV ============
const NAV = [
  { id: 'dashboard', label: 'DASHBOARD', icon: '⊞' },
  { id: 'plans', label: 'PLANS', icon: '📐' },
  { id: 'observations', label: 'OBSERVATIONS', icon: '👁' },
  { id: 'reserves', label: 'RÉSERVES', icon: '🚩' },
  { id: 'tasks', label: 'TÂCHES', icon: '✓' },
  { id: 'documents', label: 'DOCUMENTS', icon: '📁' },
  { id: 'intervenants', label: 'INTERVENANTS', icon: '👷' },
  { id: 'checklists', label: 'CHECKLISTS', icon: '☑' },
]

// ============ UTILS ============
function initials(n: string) { return (n || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) }
function Avt({ name, color, size = 28 }: { name: string; color?: string; size?: number }) {
  const bg = color || '#3D8EF0'
  return <div style={{ width: size, height: size, borderRadius: '50%', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.36, fontWeight: 700, color: '#fff', flexShrink: 0, fontFamily: "'Barlow Condensed',sans-serif" }}>{initials(name)}</div>
}

// ============ SHELL ============
export function ProjectShell({ data, projectId, children }: { data: ProjectData; projectId: string; children: React.ReactNode }) {
  // `data` est lu directement depuis les props : le placer dans un useState
  // figeait le premier rendu, si bien qu'un router.refresh() rechargeait bien
  // les données côté serveur sans que l'interface ne les reflète jamais
  // (tâche créée => invisible jusqu'au rechargement complet de la page).
  const [toast, setToast] = useState<string | null>(null)
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 2800)
    return () => clearTimeout(t)
  }, [toast])

  const refresh = useCallback(() => { router.refresh() }, [router])
  const showToast = useCallback((msg: string) => { setToast(msg) }, [])

  const currentPage = pathname.split('/').pop() || 'dashboard'
  const unread = data.notifications.filter(n => !n.is_read).length
  const critObs = data.observations.filter(o => o.priority === 'critical' && o.status !== 'validated').length
  const openObs = data.observations.filter(o => o.status === 'open').length
  const openRes = data.reserves.filter(r => r.status === 'open').length
  const pendingTasks = data.tasks.filter(t => t.status === 'pending').length

  function badge(navId: string) {
    if (navId === 'observations') return openObs
    if (navId === 'reserves') return openRes
    if (navId === 'tasks') return pendingTasks
    return 0
  }

  return (
    <ProjectCtx.Provider value={{ data, projectId, refresh, showToast }}>
      <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--bg)' }}>
        {/* SIDEBAR */}
        <div style={{ width: 200, minWidth: 200, background: 'var(--bg2)', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column' }}>
          {/* Logo */}
          <a href="/dashboard" style={{ textDecoration: 'none', display: 'block', padding: '14px 14px 12px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <div style={{ width: 28, height: 28, background: 'var(--amber)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15 }}>🏗️</div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)', fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: '1.5px' }}>SITEPILOT</div>
                <div style={{ fontSize: 8, color: 'var(--text3)', fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: '1.5px' }}>← PROJETS</div>
              </div>
            </div>
          </a>

          {/* Project info */}
          <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ padding: '8px 10px', background: 'var(--bg3)', borderRadius: 7, border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 8, color: 'var(--amber)', fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700, letterSpacing: '1.2px', marginBottom: 4 }}>PROJET ACTIF</div>
              <div style={{ fontSize: 11, color: 'var(--text)', lineHeight: 1.3, fontWeight: 600, marginBottom: 3 }}>{data.project.name.slice(0, 30)}{data.project.name.length > 30 ? '...' : ''}</div>
              <div style={{ fontSize: 9, color: 'var(--amber)', fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700, marginBottom: 5 }}>{data.project.phase?.toUpperCase()}</div>
              <div style={{ height: 3, background: 'var(--bg4)', borderRadius: 10, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${data.project.progress}%`, background: 'var(--amber)', borderRadius: 10 }} />
              </div>
              <div style={{ fontSize: 9, color: 'var(--text3)', marginTop: 3, textAlign: 'right' }}>{data.project.progress}%</div>
            </div>
          </div>

          {/* Alert */}
          {critObs > 0 && (
            <div style={{ margin: '8px 10px', padding: '5px 9px', background: 'rgba(232,64,64,0.1)', border: '1px solid rgba(232,64,64,0.25)', borderRadius: 5, display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--red)', flexShrink: 0 }} className="pulse" />
              <span style={{ fontSize: 9, color: 'var(--red)', fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700 }}>{critObs} CRITIQUE{critObs > 1 ? 'S' : ''}</span>
            </div>
          )}

          {/* Nav */}
          <nav style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
            {NAV.map(item => {
              const isActive = currentPage === item.id
              const b = badge(item.id)
              return (
                <a key={item.id} href={`/project/${projectId}/${item.id}`} style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 8, padding: '7px 14px', color: isActive ? 'var(--amber)' : 'var(--text2)', background: isActive ? 'rgba(245,166,35,0.06)' : 'transparent', borderLeft: isActive ? '2px solid var(--amber)' : '2px solid transparent', transition: 'all 0.12s', fontSize: 11 }}>
                  <span style={{ width: 14, textAlign: 'center', fontSize: 12 }}>{item.icon}</span>
                  <span style={{ flex: 1, fontFamily: "'Barlow Condensed',sans-serif", fontWeight: isActive ? 700 : 500, letterSpacing: '0.5px' }}>{item.label}</span>
                  {b > 0 && <span style={{ background: item.id === 'observations' ? 'var(--red)' : item.id === 'reserves' ? 'var(--orange)' : 'var(--amber)', color: '#0A0B0D', fontSize: 8, fontWeight: 800, padding: '1px 5px', borderRadius: 3, fontFamily: "'Barlow Condensed',sans-serif" }}>{b}</span>}
                </a>
              )
            })}
          </nav>

          {/* User */}
          <div style={{ padding: '10px 12px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Avt name={data.currentUser.name} color="var(--amber)" size={24} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text)', fontFamily: "'Barlow Condensed',sans-serif', letterSpacing: '0.3px", whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{data.currentUser.name.toUpperCase()}</div>
              <div style={{ fontSize: 8, color: 'var(--text3)', fontFamily: "'Barlow Condensed',sans-serif', letterSpacing: '0.5px" }}>CHEF DE PROJET</div>
            </div>
          </div>
        </div>

        {/* MAIN */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Topbar */}
          <div style={{ height: 48, borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', padding: '0 20px', gap: 14, background: 'var(--bg2)', flexShrink: 0 }}>
            <div style={{ flex: 1, fontSize: 10, color: 'var(--text3)', fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: '2px' }}>
              {NAV.find(n => n.id === currentPage)?.icon} {NAV.find(n => n.id === currentPage)?.label} — {data.project.name.toUpperCase()}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 10px' }}>
              <span style={{ color: 'var(--text3)', fontSize: 11 }}>🔍</span>
              <input placeholder="Rechercher..." style={{ background: 'none', border: 'none', color: 'var(--text)', fontSize: 11, width: 150, fontFamily: "'IBM Plex Mono',monospace" }} />
            </div>
            <div style={{ padding: '4px 8px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12, cursor: 'pointer', position: 'relative' }}>
              🔔
              {unread > 0 && <div style={{ position: 'absolute', top: 3, right: 3, width: 6, height: 6, background: 'var(--red)', borderRadius: '50%', border: '1.5px solid var(--bg2)' }} />}
            </div>
            <div style={{ fontSize: 9, color: 'var(--text3)', fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: '0.5px', background: 'var(--bg3)', border: '1px solid var(--border)', padding: '3px 8px', borderRadius: 5 }}>
              📅 {new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }).toUpperCase()}
            </div>
          </div>

          {/* Content */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '20px 22px' }}>
            {children}
          </div>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', bottom: 20, right: 20, background: 'var(--bg2)', border: '1px solid rgba(245,166,35,0.4)', color: 'var(--amber)', padding: '9px 16px', borderRadius: 8, fontSize: 11, fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700, letterSpacing: '0.5px', zIndex: 500 }}>
          ✓ {toast.toUpperCase()}
        </div>
      )}
    </ProjectCtx.Provider>
  )
}
