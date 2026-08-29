import { redirect } from 'next/navigation'
import { createClientOrNull } from '@/lib/supabase/server'
import { SetupNotice } from '@/components/system/SetupNotice'

// Ces pages dépendent de la session (cookies) : elles doivent être évaluées
// à chaque requête. Sans cela, Next peut les prérendre au build — et figer
// dans le HTML l'état observé au moment de la construction.
export const dynamic = 'force-dynamic'

export default async function RootPage() {
  const supabase = await createClientOrNull()
  if (!supabase) return <SetupNotice />

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')
  redirect('/dashboard')
}
