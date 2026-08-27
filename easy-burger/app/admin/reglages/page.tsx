import { createClient } from '@/lib/supabase/server'
import { getStaffUser, isAtLeast } from '@/lib/staff'
import { SettingsForm } from '@/components/admin/SettingsForm'

export const dynamic = 'force-dynamic'

/**
 * §0 — « Aucune règle métier en dur dans le code. Tout ce qui est un montant,
 * un seuil, un ratio ou un délai vit dans la table `settings` et se modifie
 * depuis le back-office. » C'est cet écran.
 */
export default async function SettingsPage() {
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
    ? await supabase.from('settings').select('key, value, label').order('key')
    : { data: [] }

  return (
    <>
      <h1 className="text-display-l">Réglages</h1>
      <p className="mt-1 max-w-xl text-body-s text-eb-grey">
        Chaque valeur ici est une règle métier. Aucune n’est écrite dans le
        code : ce que tu changes prend effet dans la minute.
      </p>

      <div className="mt-8 max-w-xl">
        <SettingsForm settings={(data ?? []) as never} />
      </div>
    </>
  )
}
