import { createClient } from '@/lib/supabase/server'
import { getStaffUser, isAtLeast } from '@/lib/staff'
import { RewardsAdmin } from '@/components/admin/RewardsAdmin'

export const dynamic = 'force-dynamic'

export default async function RewardsAdminPage() {
  const staff = await getStaffUser()
  if (!isAtLeast(staff, 'admin')) {
    return (
      <p className="bg-eb-cream px-5 py-10 text-center text-body text-eb-grey">
        Réservé aux administrateurs.
      </p>
    )
  }

  const supabase = await createClient()
  const { data } = supabase
    ? await supabase
        .from('rewards')
        .select('id, slug, title, points_cost, is_active')
        .order('sort_order')
    : { data: [] }

  return (
    <>
      <h1 className="text-display-l">Boutique de récompenses</h1>
      <p className="mt-1 max-w-xl text-body-s text-eb-grey">
        Le ratio points/dirham et l’expiration se règlent dans l’onglet
        Réglages. Ici, ce sont les paliers. Avec un panier moyen autour de
        100 MAD, la première récompense doit tomber à la deuxième visite —
        un client qui attend douze visites décroche.
      </p>

      <RewardsAdmin rewards={(data ?? []) as never} />
    </>
  )
}
