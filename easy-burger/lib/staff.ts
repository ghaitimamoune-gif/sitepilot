import { createClient } from './supabase/server'
import { ROLE_LABELS, rankOf } from './roles'
import type { StaffRole } from '@/types/db'

export type StaffUser = {
  id: string
  name: string
  role: StaffRole
}

/**
 * Le membre du personnel connecté, ou `null`.
 *
 * Ce n'est pas la barrière de sécurité : celle-ci est en base (RLS + les
 * fonctions `security definer` qui revérifient le rôle à chaque appel).
 * C'est ce qui permet d'afficher ou de masquer un bouton.
 */
export async function getStaffUser(): Promise<StaffUser | null> {
  const supabase = await createClient()
  if (!supabase) return null

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('staff_users')
    .select('id, name, role')
    .eq('id', user.id)
    .eq('is_active', true)
    .maybeSingle()

  return (data as StaffUser | null) ?? null
}

export function isAtLeast(staff: StaffUser | null, required: StaffRole): boolean {
  if (!staff) return false
  return rankOf(staff.role) >= rankOf(required)
}

// Réexporté pour que les écrans serveur n'aient qu'un import à faire.
export { ROLE_LABELS } from './roles'
