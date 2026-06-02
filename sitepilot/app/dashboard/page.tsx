import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { CreateProjectForm } from '@/components/project/CreateProjectForm'
import { LogoutButton } from '@/components/auth/LogoutButton'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()

  const { data: memberships } = await supabase
    .from('project_members')
    .select('project_id, role, project:projects(*)')
    .eq('user_id', user.id)

  const { data: ownedProjects } = await supabase
    .from('projects')
    .select('*')
    .eq('owner_id', user.id)

  const allProjects = [
    ...(ownedProjects || []),
    ...(memberships || []).map((m: { project: unknown }) => m.project).filter(Boolean)
  ].filter((p, i, arr) => arr.findIndex((q: { id: string }) => q.id === (p as { id: string }).id) === i) as Array<{ id: string; name: string; address: string; phase: string; progress: number }>

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', padding: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 32, height: 32, background: 'var(--amber)', borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>🏗️</div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)', fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: '1.5px' }}>SITEPILOT</div>
            <div style={{ fontSize: 10, color: 'var(--text3)', fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: '1px' }}>MES PROJETS</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ fontSize: 12, color: 'var(--text2)' }}>{profile?.full_name || user.email}</div>
          <LogoutButton />
        </div>
      </div>

      {/* Projects grid */}
      {allProjects.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--text3)' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🏗️</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text2)', marginBottom: 8, fontFamily: "'Barlow Condensed',sans-serif" }}>Aucun projet</div>
          <div style={{ fontSize: 13, marginBottom: 32 }}>Créez votre premier projet chantier</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16, marginBottom: 24 }}>
          {allProjects.map((p) => (
            <Link key={p.id} href={`/project/${p.id}`} style={{ textDecoration: 'none' }}>
              <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, padding: 18, cursor: 'pointer', transition: 'all 0.15s' }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--amber)')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
              >
                <div style={{ fontSize: 22, marginBottom: 10 }}>🏗️</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 4, fontFamily: "'Barlow Condensed',sans-serif" }}>{p.name}</div>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 12 }}>{p.address}</div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 11, color: 'var(--amber)', fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700 }}>{p.phase?.toUpperCase()}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', fontFamily: "'Barlow Condensed',sans-serif" }}>{p.progress}%</span>
                </div>
                <div style={{ height: 4, background: 'var(--bg4)', borderRadius: 10, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${p.progress}%`, background: 'var(--amber)', borderRadius: 10 }} />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Create new project */}
      <CreateProjectForm userId={user.id} />
    </div>
  )
}
