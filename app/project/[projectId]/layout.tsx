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
    observations: (observations || []).map((o: Record<string, unknown>) => ({
      ...o,
      photos: (o.obs_photos as unknown[]) || [],
      comments: (o.obs_comments as unknown[]) || [],
      history: (o.obs_history as unknown[]) || [],
    })),
    reserves: (reserves || []).map((r: Record<string, unknown>) => ({ ...r, photos: (r.reserve_photos as unknown[]) || [] })),
    tasks: tasks || [],
    documents: documents || [],
    checklists: (checklists || []).map((cl: Record<string, unknown>) => ({ ...cl, items: (cl.checklist_items as unknown[]) || [] })),
    notifications: notifications || [],
    currentUser: { id: user.id, email: user.email || '', name: profile?.full_name || user.email || '', role: profile?.role || 'chef_projet' },
  }

  /* eslint-disable @typescript-eslint/no-explicit-any */
  return <ProjectShell data={data as any} projectId={projectId}>{children}</ProjectShell>
}
