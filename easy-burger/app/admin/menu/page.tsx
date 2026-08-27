import { createClient } from '@/lib/supabase/server'
import { getStaffUser, isAtLeast } from '@/lib/staff'
import { MenuAdmin } from '@/components/admin/MenuAdmin'

export const dynamic = 'force-dynamic'

export default async function MenuAdminPage() {
  const staff = await getStaffUser()
  if (!isAtLeast(staff, 'manager')) {
    return (
      <p className="bg-eb-cream px-5 py-10 text-center text-body text-eb-grey">
        Réservé aux responsables.
      </p>
    )
  }

  const supabase = await createClient()
  const { data } = supabase
    ? await supabase
        .from('categories')
        .select(
          'id, name, sort_order, products ( id, name, description, price_cents, image_url, is_available, sort_order )',
        )
        .order('sort_order')
    : { data: [] }

  return (
    <>
      <h1 className="text-display-l">Menu</h1>
      <p className="mt-1 text-body-s text-eb-grey">
        Le menu vit en base. Une rupture se marque en un clic et prend effet
        tout de suite sur la carte.
      </p>

      <MenuAdmin categories={(data ?? []) as never} />
    </>
  )
}
