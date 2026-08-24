import { getStaffUser } from '@/lib/staff'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { CreditTicketForm } from '@/components/admin/CreditTicketForm'
import { Eyebrow } from '@/components/ui/Eyebrow'

export const dynamic = 'force-dynamic'

export default async function StaffPage() {
  const staff = await getStaffUser()

  if (!isSupabaseConfigured) {
    return (
      <p className="bg-eb-cream px-5 py-10 text-center text-body text-eb-grey">
        La base n’est pas branchée.
      </p>
    )
  }

  if (!staff) {
    return (
      <p className="bg-eb-cream px-5 py-10 text-center text-body text-eb-grey">
        Ce compte ne figure pas dans le personnel.
      </p>
    )
  }

  return (
    <>
      <h1 className="mb-1 text-display-l">Créditer des points</h1>
      <p className="mb-6 text-body-s text-eb-grey">
        Deux gestes, cinq secondes. Ça marche sans aucune connexion à la
        caisse — et le même ticket ne peut jamais être crédité deux fois.
      </p>

      <CreditTicketForm />

      <p className="mt-8 border-t border-eb-line pt-4">
        <Eyebrow className="text-eb-grey">connecté · {staff.name}</Eyebrow>
      </p>
    </>
  )
}
