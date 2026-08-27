import { createClient } from '@/lib/supabase/server'
import { getStaffUser, isAtLeast } from '@/lib/staff'
import { Eyebrow } from '@/components/ui/Eyebrow'

export const dynamic = 'force-dynamic'

type Entry = {
  id: number
  actor_name: string | null
  action: string
  entity: string
  entity_id: string | null
  payload: Record<string, unknown>
  created_at: string
}

const ACTION_LABEL: Record<string, string> = {
  'order.status': 'Statut de commande',
  'loyalty.credit_ticket': 'Crédit au comptoir',
  'loyalty.adjust': 'Ajustement manuel de points',
  'reward.consume': 'Récompense validée',
  'claim_codes.generate': 'Lot de codes généré',
  'pos_tickets.import': 'Import des ventes',
}

/** §6.5 — table d'audit non modifiable. Même un superadmin ne peut pas la réécrire. */
export default async function JournalPage() {
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
        .from('audit_log')
        .select('id, actor_name, action, entity, entity_id, payload, created_at')
        .order('created_at', { ascending: false })
        .limit(100)
    : { data: [] }

  const entries = (data ?? []) as Entry[]

  return (
    <>
      <h1 className="text-display-l">Journal d’audit</h1>
      <p className="mt-1 max-w-xl text-body-s text-eb-grey">
        Chaque geste sensible y laisse une trace. La table n’a aucune policy
        de modification : personne ne peut réécrire l’histoire depuis
        l’application.
      </p>

      {entries.length === 0 ? (
        <p className="mt-6 bg-eb-cream px-5 py-8 text-center text-body text-eb-grey">
          Aucune entrée.
        </p>
      ) : (
        <ul className="mt-6 flex flex-col">
          {entries.map((e) => (
            <li key={e.id} className="border-b border-eb-line py-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-body-l">
                  {ACTION_LABEL[e.action] ?? e.action}
                  {e.actor_name && (
                    <span className="text-eb-grey"> · {e.actor_name}</span>
                  )}
                </p>
                <Eyebrow className="text-eb-grey">
                  {new Date(e.created_at).toLocaleString('fr-FR', {
                    dateStyle: 'short',
                    timeStyle: 'short',
                  })}
                </Eyebrow>
              </div>
              <p className="eb-price mt-1 break-all text-body-s text-eb-grey">
                {summarise(e.payload)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

/** Le détail brut est illisible ; on n'en garde que les clés qui parlent. */
function summarise(payload: Record<string, unknown>): string {
  return Object.entries(payload)
    .filter(([, v]) => v !== null && v !== undefined && v !== '')
    .map(([k, v]) => `${k} ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`)
    .join(' · ')
}
