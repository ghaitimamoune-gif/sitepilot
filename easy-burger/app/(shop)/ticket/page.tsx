import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getCurrentCustomer } from '@/lib/customer'
import { createClient } from '@/lib/supabase/server'
import { getSetting } from '@/lib/settings'
import { TicketClaimForm } from '@/components/claim/TicketClaimForm'
import { Eyebrow } from '@/components/ui/Eyebrow'
import { Price } from '@/components/ui/Price'

export const metadata: Metadata = { title: 'Réclamer un ticket' }
export const dynamic = 'force-dynamic'

const STATUS_LABEL = {
  pending: 'En attente de vérification',
  matched: 'Points crédités',
  rejected: 'Refusée',
} as const

type Claim = {
  id: string
  ticket_ref: string
  amount_cents: number
  ticket_date: string
  status: keyof typeof STATUS_LABEL
  reject_reason: string | null
}

/**
 * §11.3 — le filet pour le client qui a oublié de donner son numéro.
 *
 * Le crédit part en attente et se confirme la nuit, au rapprochement avec
 * l'export des ventes. On le dit clairement plutôt que de laisser croire à
 * un crédit immédiat.
 */
export default async function TicketPage() {
  const customer = await getCurrentCustomer()
  if (!customer) redirect('/connexion?suite=%2Fticket')

  const supabase = await createClient()
  const [{ data }, days] = await Promise.all([
    supabase
      ? supabase
          .from('pos_claims')
          .select('id, ticket_ref, amount_cents, ticket_date, status, reject_reason')
          .order('created_at', { ascending: false })
          .limit(10)
      : Promise.resolve({ data: [] }),
    getSetting<number>('ticket_claim_days'),
  ])

  const claims = (data ?? []) as Claim[]

  return (
    <div className="px-4 pt-6">
      <h1 className="text-display-l">Réclamer un ticket</h1>
      <p className="mt-1 max-w-md text-body-s text-eb-grey">
        Tu as commandé au comptoir sans donner ton numéro ? Saisis le ticket,
        on vérifie et les points arrivent. Tu as {days ?? 7} jours.
      </p>

      <div className="mt-6 max-w-sm">
        <TicketClaimForm maxDays={days ?? 7} />
      </div>

      {claims.length > 0 && (
        <section className="mt-10 border-t border-eb-line pt-6">
          <h2 className="mb-3 text-display-m">Mes réclamations</h2>
          <ul className="flex flex-col">
            {claims.map((c) => (
              <li
                key={c.id}
                className="flex items-baseline justify-between gap-4 border-b border-eb-line py-3"
              >
                <div className="min-w-0">
                  <p className="eb-price text-body-l">{c.ticket_ref}</p>
                  <p className="text-body-s text-eb-grey">
                    {new Date(c.ticket_date).toLocaleDateString('fr-FR')} ·{' '}
                    <Price cents={c.amount_cents} />
                    {c.reject_reason ? ` · ${c.reject_reason}` : ''}
                  </p>
                </div>
                <Eyebrow
                  className={c.status === 'rejected' ? 'text-eb-grey' : 'text-eb-orange'}
                >
                  {STATUS_LABEL[c.status]}
                </Eyebrow>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
