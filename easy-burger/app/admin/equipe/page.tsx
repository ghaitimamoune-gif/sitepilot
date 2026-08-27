import { createClient } from '@/lib/supabase/server'
import { getStaffUser, isAtLeast, ROLE_LABELS } from '@/lib/staff'
import { TeamAdmin } from '@/components/admin/TeamAdmin'
import type { StaffRole } from '@/types/db'

export const dynamic = 'force-dynamic'

export default async function TeamPage() {
  const staff = await getStaffUser()
  if (!isAtLeast(staff, 'superadmin')) {
    return (
      <p className="bg-eb-cream px-5 py-10 text-center text-body text-eb-grey">
        La gestion du personnel est réservée au superadmin. C’est volontaire :
        c’est ce qui empêche un administrateur de se promouvoir lui-même.
      </p>
    )
  }

  const supabase = await createClient()
  const { data } = supabase
    ? await supabase
        .from('staff_users')
        .select('id, name, phone, role, is_active, created_at')
        .order('created_at')
    : { data: [] }

  return (
    <>
      <h1 className="text-display-l">Équipe</h1>
      <p className="mt-1 max-w-xl text-body-s text-eb-grey">
        Quatre rôles, du moins au plus puissant :{' '}
        {(Object.keys(ROLE_LABELS) as StaffRole[])
          .map((r) => ROLE_LABELS[r].toLowerCase())
          .join(', ')}
        .
      </p>

      <TeamAdmin members={(data ?? []) as never} currentId={staff!.id} />

      <section className="mt-10 border-t border-eb-line pt-6">
        <h2 className="mb-2 text-display-m">Ajouter quelqu’un</h2>
        <p className="max-w-xl text-body-s text-eb-grey">
          Créer le compte dans Supabase → Authentication → Users (e-mail +
          mot de passe, « Auto Confirm User » coché), puis dans le SQL Editor :
        </p>
        <pre className="eb-price mt-3 overflow-x-auto border border-eb-line p-3 text-body-s">
{`insert into public.staff_users (id, name, role)
values ('<uuid-du-compte>', 'Prénom', 'cashier');`}
        </pre>
        <p className="mt-2 max-w-xl text-body-s text-eb-grey">
          Il n’existe volontairement aucun bouton « inviter » : créer un compte
          du personnel depuis l’application demanderait d’exposer la clé de
          service, et une clé de service exposée est une porte ouverte sur
          toute la base.
        </p>
      </section>
    </>
  )
}
