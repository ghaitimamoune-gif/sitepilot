import type { StaffRole } from '@/types/db'

/**
 * Rôles et libellés, sans aucune dépendance serveur.
 *
 * `lib/staff.ts` importe `next/headers` pour lire la session : un composant
 * client qui voudrait seulement afficher « Caissier » entraînerait tout le
 * client Supabase serveur dans le bundle, et le build échoue. D'où ce module
 * séparé, importable des deux côtés.
 */
const RANK: Record<StaffRole, number> = {
  cashier: 10,
  manager: 20,
  admin: 30,
  superadmin: 40,
}

export const ROLE_LABELS: Record<StaffRole, string> = {
  cashier: 'Caissier',
  manager: 'Responsable',
  admin: 'Administrateur',
  superadmin: 'Superadmin',
}

export const ROLES: StaffRole[] = ['cashier', 'manager', 'admin', 'superadmin']

export function rankOf(role: StaffRole): number {
  return RANK[role]
}
