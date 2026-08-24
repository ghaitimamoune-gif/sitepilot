import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getStaffUser, isAtLeast } from '@/lib/staff'
import { phoneSearchFragment, formatPhone } from '@/lib/phone'
import type { CustomerRow } from '@/types/db'
import { Eyebrow } from '@/components/ui/Eyebrow'
import { Price } from '@/components/ui/Price'

export const dynamic = 'force-dynamic'

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const staff = await getStaffUser()
  if (!isAtLeast(staff, 'admin')) return <Denied />

  const { q = '' } = await searchParams
  const supabase = await createClient()
  if (!supabase) return null

  let customers: CustomerRow[] = []

  if (q.trim()) {
    const fragment = phoneSearchFragment(q)
    let query = supabase
      .from('customers')
      .select(
        'id, phone, first_name, last_name, points_balance, lifetime_spend, orders_count, last_order_at, created_at',
      )
      .limit(25)

    query = fragment.length >= 4
      ? query.ilike('phone', `%${fragment}`)
      : query.ilike('first_name', `%${q.trim()}%`)

    const { data } = await query.order('last_order_at', { ascending: false, nullsFirst: false })
    customers = (data ?? []) as CustomerRow[]
  }

  return (
    <>
      <h1 className="mb-1 text-display-l">Clients</h1>
      <p className="mb-6 text-body-s text-eb-grey">
        Recherche par téléphone — quel que soit le format saisi — ou par prénom.
      </p>

      <form method="get" className="mb-8 flex gap-2">
        <input
          name="q"
          defaultValue={q}
          placeholder="06 12 34 56 78"
          inputMode="tel"
          autoFocus
          className="h-touch flex-1 border border-eb-line px-3 text-body-l"
        />
        <button className="h-touch rounded-button bg-eb-black px-5 text-body font-semibold text-eb-white">
          Chercher
        </button>
      </form>

      {q.trim() && customers.length === 0 && (
        <p className="bg-eb-cream px-5 py-8 text-center text-body text-eb-grey">
          Aucun client pour « {q} ».
        </p>
      )}

      <ul className="flex flex-col">
        {customers.map((c) => (
          <li key={c.id}>
            <Link
              href={`/admin/clients/${c.id}`}
              className="flex items-center justify-between gap-4 border-b border-eb-line py-3"
            >
              <div>
                <p className="eb-price text-body-l font-semibold">
                  {formatPhone(c.phone)}
                </p>
                <p className="text-body-s text-eb-grey">
                  {c.first_name ?? 'Sans prénom'} · {c.orders_count} commande
                  {c.orders_count > 1 ? 's' : ''} ·{' '}
                  <Price cents={c.lifetime_spend} suffix={false} /> MAD cumulés
                </p>
              </div>
              <div className="text-right">
                <Eyebrow className="text-eb-grey">solde</Eyebrow>
                <p className="eb-price font-display text-display-m">
                  {c.points_balance}
                </p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </>
  )
}

function Denied() {
  return (
    <p className="bg-eb-cream px-5 py-10 text-center text-body text-eb-grey">
      La fiche client est réservée aux administrateurs.
    </p>
  )
}
