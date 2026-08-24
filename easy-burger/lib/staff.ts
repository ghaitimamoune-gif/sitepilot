import { createClient } from './supabase/server'
import type { StaffRole } from '@/types/db'

export type StaffUser = {
  id: string
  name: string
  role: StaffRole
}

const RANK: Record<StaffRole, number> = {
  cashier: 10,
  manager: 20,
  admin: 30,
  superadmin: 40,
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
  return RANK[staff.role] >= RANK[required]
}

export const ROLE_LABELS: Record<StaffRole, string> = {
  cashier: 'Caissier',
  manager: 'Responsable',
  admin: 'Administrateur',
  superadmin: 'Superadmin',
}
