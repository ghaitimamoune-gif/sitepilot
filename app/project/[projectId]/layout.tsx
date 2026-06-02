import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ProjectShell } from '@/components/project/ProjectShell'

export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ projectId: string }>
}) {
  const { projectId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: project } = await supabase.from('projects').select('*').eq('id', projectId).single()
  if (!project) notFound()

  const [
    { data: intervenants },
    { data: plans },
    { data: observations },
    { data: reserves },
    { data: tasks },
    { data: documents },
    { data: checklists },
    { data: notifications },
    { data: profile },
  ] = await Promise.all([
    supabase.from('intervenants').select('*').eq('project_id', projectId).order('name'),
    supabase.from('plans').select('*').eq('project_id', projectId).order('uploaded_at', { ascending: false }),
    supabase.from('observations').select('*, obs_photos(*), obs_comments(*), obs_history(*)').eq('project_id', projectId).order('created_at', { ascending: false }),
    supabase.from('reserves').select('*, reserve_photos(*)').eq('project_id', projectId).order('created_at', { ascending: false }),
    supabase.from('tasks').select('*').eq('project_id', projectId).order('created_at', { ascending: false }),
    supabase.from('documents').select('*').eq('project_id', projectId).order('uploaded_at', { ascending: false }),
    supabase.from('checklists').select('*, checklist_items(*)').eq('project_id', projectId).order('created_at', { ascending: false }),
    supabase.from('notifications').select('*').eq('project_id', projectId).eq('user_id', user.id).order('created_at', { ascending: false }).limit(20),
    supabase.from('profiles').select('*').eq('id', user.id).single(),
  ])

  const data = {
    project,
    intervenants: intervenants || [],
    plans: plans || [],
    observations: (observations || []).map((o: { obs_photos: unknown[]; obs_comments: unknown[]; obs_history: unknown[] }) => ({
      ...o, photos: o.obs_photos || [], comments: o.obs_comments || [], history: o.obs_history || [],
    })),
    reserves: (reserves || []).map((r: { reserve_photos: unknown[] }) => ({ ...r, photos: r.reserve_photos || [] })),
    tasks: tasks || [],
    documents: documents || [],
    checklists: (checklists || []).map((cl: { checklist_items: unknown[] }) => ({ ...cl, items: cl.checklist_items || [] })),
    notifications: notifications || [],
    currentUser: { id: user.id, email: user.email || '', name: profile?.full_name || user.email || '', role: profile?.role || 'chef_projet' },
  }

  return <ProjectShell data={data} projectId={projectId}>{children}</ProjectShell>
}
