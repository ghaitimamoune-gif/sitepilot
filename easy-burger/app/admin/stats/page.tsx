import { createClient } from '@/lib/supabase/server'
import { getStaffUser, isAtLeast } from '@/lib/staff'
import { Eyebrow } from '@/components/ui/Eyebrow'
import { formatMAD } from '@/lib/money'

export const dynamic = 'force-dynamic'

type Stats = {
  orders: number
  completed: number
  cancelled: number
  revenue_cents: number
  avg_basket_cents: number
  delivery_share: number
  new_customers: number
  identified_customers: number
  points_earned: number
  points_redeemed: number
  points_expired: number
  redeemed_value_cents: number
  counter_tickets: number
  counter_identified: number
  identification_rate: number | null
}

type Cashier = {
  staff_id: string
  name: string
  credits: number
  points: number
  amount_cents: number
  last_credit: string | null
}

const RANGES = [
  { key: 'jour', label: 'Aujourd’hui', days: 0 },
  { key: 'semaine', label: '7 jours', days: 6 },
  { key: 'mois', label: '30 jours', days: 29 },
] as const

export default async function StatsPage({
  searchParams,
}: {
  searchParams: Promise<{ p?: string }>
}) {
  const staff = await getStaffUser()
  if (!isAtLeast(staff, 'manager')) {
    return (
      <p className="bg-eb-cream px-5 py-10 text-center text-body text-eb-grey">
        Réservé aux responsables.
      </p>
    )
  }

  const { p = 'jour' } = await searchParams
  const range = RANGES.find((r) => r.key === p) ?? RANGES[0]

  const to = new Date()
  const from = new Date(to.getTime() - range.days * 86400000)
  const iso = (d: Date) => d.toISOString().slice(0, 10)

  const supabase = await createClient()
  const [stats, cashiers] = await Promise.all([
    supabase
      ? supabase
          .rpc('dashboard_stats', { p_from: iso(from), p_to: iso(to) })
          .then((r) => r.data as Stats | null)
      : Promise.resolve(null),
    supabase
      ? supabase
          .rpc('cashier_stats', { p_from: iso(from), p_to: iso(to) })
          .then((r) => (r.data ?? []) as Cashier[])
      : Promise.resolve([]),
  ])

  if (!stats) {
    return (
      <p className="bg-eb-cream px-5 py-10 text-center text-body text-eb-grey">
        Statistiques indisponibles.
      </p>
    )
  }

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-display-l">Tableau de bord</h1>
        <nav className="flex gap-1">
          {RANGES.map((r) => (
            <a
              key={r.key}
              href={`/admin/stats?p=${r.key}`}
              className={`eb-eyebrow inline-flex h-9 items-center px-3 font-util ${
                r.key === range.key ? 'bg-eb-black text-eb-white' : 'text-eb-grey'
              }`}
            >
              {r.label}
            </a>
          ))}
        </nav>
      </div>

      <section className="mt-6 grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-4">
        <Metric label="commandes" value={String(stats.completed)} />
        <Metric label="chiffre d’affaires" value={formatMAD(stats.revenue_cents)} />
        <Metric label="panier moyen" value={formatMAD(stats.avg_basket_cents)} />
        <Metric label="part livraison" value={`${stats.delivery_share} %`} />
      </section>

      <section className="mt-10 border-t border-eb-line pt-6">
        <h2 className="mb-4 text-display-m">Base clients</h2>
        <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-4">
          <Metric label="nouveaux clients" value={String(stats.new_customers)} />
          <Metric
            label="dont profil complété"
            value={String(stats.identified_customers)}
          />
          <Metric label="commandes annulées" value={String(stats.cancelled)} />
          <Metric
            label="canal direct"
            value={stats.orders > 0 ? `${stats.orders} cde` : '—'}
          />
        </div>
      </section>

      <section className="mt-10 border-t border-eb-line pt-6">
        <h2 className="mb-1 text-display-m">Points</h2>
        <p className="mb-4 text-body-s text-eb-grey">
          Les points émis ne coûtent rien tant qu’ils ne sont pas utilisés.
          Seule la colonne « utilisés » est une dépense réelle.
        </p>
        <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-4">
          <Metric label="émis" value={String(stats.points_earned)} />
          <Metric label="utilisés" value={String(stats.points_redeemed)} />
          <Metric label="expirés" value={String(stats.points_expired)} />
          <Metric
            label="coût des récompenses"
            value={formatMAD(stats.redeemed_value_cents)}
          />
        </div>
      </section>

      {/* §11.2 — l'indicateur de succès du programme. */}
      <section className="mt-10 border-t border-eb-line pt-6">
        <h2 className="mb-1 text-display-m">Taux d’identification</h2>
        <p className="mb-4 max-w-xl text-body-s text-eb-grey">
          Part des tickets de caisse rattachés à un numéro. C’est l’indicateur
          qui dit si le personnel pense à demander le numéro — le reste du
          programme en dépend.
        </p>

        {stats.counter_tickets === 0 ? (
          <p className="bg-eb-cream px-4 py-3 text-body-s text-eb-grey">
            Aucun ticket importé sur la période. Importe l’export des ventes
            depuis l’onglet Tickets pour voir ce taux.
          </p>
        ) : (
          <div className="flex items-baseline gap-6">
            <p className="eb-price font-display text-display-xl">
              {stats.identification_rate} %
            </p>
            <p className="text-body-s text-eb-grey">
              {stats.counter_identified} tickets identifiés sur{' '}
              {stats.counter_tickets}
            </p>
          </div>
        )}

        {cashiers.length > 0 && (
          <ul className="mt-6 flex flex-col">
            {cashiers.map((c) => (
              <li
                key={c.staff_id}
                className="flex items-baseline justify-between gap-4 border-b border-eb-line py-3"
              >
                <div>
                  <p className="text-body-l">{c.name}</p>
                  <p className="text-body-s text-eb-grey">
                    {c.last_credit
                      ? `dernier crédit ${new Date(c.last_credit).toLocaleDateString('fr-FR')}`
                      : 'aucun crédit sur la période'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="eb-price text-body-l font-semibold">{c.credits}</p>
                  <Eyebrow className="text-eb-grey">crédits saisis</Eyebrow>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <Eyebrow className="text-eb-grey">{label}</Eyebrow>
      <p className="eb-price font-display text-display-m">{value}</p>
    </div>
  )
}
