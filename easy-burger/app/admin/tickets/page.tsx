import { createClient } from '@/lib/supabase/server'
import { getStaffUser, isAtLeast } from '@/lib/staff'
import { ImportTicketsForm } from '@/components/admin/ImportTicketsForm'
import { Eyebrow } from '@/components/ui/Eyebrow'
import { Price } from '@/components/ui/Price'

export const dynamic = 'force-dynamic'

type Claim = {
  id: string
  ticket_ref: string
  amount_cents: number
  ticket_date: string
  status: 'pending' | 'matched' | 'rejected'
  reject_reason: string | null
  created_at: string
  customers: { phone: string } | { phone: string }[] | null
}

const LABEL = {
  pending: 'En attente',
  matched: 'Créditée',
  rejected: 'Rejetée',
} as const

export default async function TicketsPage() {
  const staff = await getStaffUser()
  if (!isAtLeast(staff, 'manager')) {
    return (
      <p className="bg-eb-cream px-5 py-10 text-center text-body text-eb-grey">
        Réservé aux responsables.
      </p>
    )
  }

  const supabase = await createClient()
  const [claims, ticketCount] = await Promise.all([
    supabase
      ? supabase
          .from('pos_claims')
          .select(
            'id, ticket_ref, amount_cents, ticket_date, status, reject_reason, created_at, customers ( phone )',
          )
          .order('created_at', { ascending: false })
          .limit(50)
          .then((r) => (r.data ?? []) as unknown as Claim[])
      : Promise.resolve([] as Claim[]),
    supabase
      ? supabase
          .from('pos_tickets')
          .select('id', { count: 'exact', head: true })
          .then((r) => r.count ?? 0)
      : Promise.resolve(0),
  ])

  const pending = claims.filter((c) => c.status === 'pending').length

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-display-l">Tickets de caisse</h1>
          <p className="mt-1 max-w-xl text-body-s text-eb-grey">
            §11.3 — aucune API Lacaisse nécessaire. Colle l’export des ventes,
            le rapprochement se fait dans la foulée.
          </p>
        </div>
        <div className="flex gap-6">
          <Stat label="tickets importés" value={String(ticketCount)} />
          <Stat label="réclamations en attente" value={String(pending)} />
        </div>
      </div>

      <section className="mt-8 max-w-2xl">
        <ImportTicketsForm />
      </section>

      <section className="mt-10 border-t border-eb-line pt-6">
        <h2 className="mb-4 text-display-m">Réclamations</h2>
        {claims.length === 0 ? (
          <p className="bg-eb-cream px-5 py-8 text-center text-body text-eb-grey">
            Aucune réclamation.
          </p>
        ) : (
          <ul className="flex flex-col">
            {claims.map((c) => (
              <li
                key={c.id}
                className="flex items-baseline justify-between gap-4 border-b border-eb-line py-3"
              >
                <div className="min-w-0">
                  <p className="eb-price text-body-l font-semibold">{c.ticket_ref}</p>
                  <p className="text-body-s text-eb-grey">
                    {phoneOf(c)} ·{' '}
                    {new Date(c.ticket_date).toLocaleDateString('fr-FR')} ·{' '}
                    <Price cents={c.amount_cents} />
                    {c.reject_reason ? ` · ${c.reject_reason}` : ''}
                  </p>
                </div>
                <Eyebrow
                  className={c.status === 'rejected' ? 'text-eb-grey' : 'text-eb-orange'}
                >
                  {LABEL[c.status]}
                </Eyebrow>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  )
}

function phoneOf(c: Claim): string {
  const rel = c.customers
  if (!rel) return '—'
  return Array.isArray(rel) ? (rel[0]?.phone ?? '—') : rel.phone
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <Eyebrow className="text-eb-grey">{label}</Eyebrow>
      <p className="eb-price font-display text-display-m">{value}</p>
    </div>
  )
}
