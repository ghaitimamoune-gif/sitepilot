import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getStaffUser, isAtLeast } from '@/lib/staff'
import { formatPhone } from '@/lib/phone'
import type { CustomerRow, LoyaltyRow } from '@/types/db'
import { Eyebrow } from '@/components/ui/Eyebrow'
import { Price } from '@/components/ui/Price'
import { EasyPattern } from '@/components/brand/EasyPattern'
import { AdjustPointsForm } from '@/components/admin/AdjustPointsForm'

export const dynamic = 'force-dynamic'

const SOURCE_LABEL: Record<string, string> = {
  app_order: 'Commande app',
  pos_ticket: 'Ticket caisse',
  glovo_code: 'Code Glovo',
  ticket_claim: 'Réclamation ticket',
  manual: 'Ajustement manuel',
  welcome: 'Bienvenue',
  birthday: 'Anniversaire',
  reward: 'Récompense',
  expiry: 'Expiration',
}

export default async function CustomerPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const staff = await getStaffUser()
  if (!isAtLeast(staff, 'admin')) {
    return (
      <p className="bg-eb-cream px-5 py-10 text-center text-body text-eb-grey">
        La fiche client est réservée aux administrateurs.
      </p>
    )
  }

  const { id } = await params
  const supabase = await createClient()
  if (!supabase) return null

  const [{ data: customer }, { data: ledger }] = await Promise.all([
    supabase
      .from('customers')
      .select(
        'id, phone, first_name, last_name, points_balance, lifetime_spend, orders_count, last_order_at, created_at',
      )
      .eq('id', id)
      .maybeSingle(),
    supabase
      .from('loyalty_transactions')
      .select(
        'id, type, source, source_ref, points, amount_cents, note, created_at, orders ( order_number )',
      )
      .eq('customer_id', id)
      .order('created_at', { ascending: false })
      .limit(50),
  ])

  if (!customer) notFound()

  const c = customer as CustomerRow
  const rows = (ledger ?? []) as unknown as LoyaltyRow[]
  const canAdjust = isAtLeast(staff, 'superadmin')

  return (
    <>
      {/* ------------------------------------------------------------ 360 */}
      <section className="relative overflow-hidden bg-eb-black px-5 py-7 text-eb-white">
        <EasyPattern ink="blanc" opacity={0.06} scale={200} />
        <div className="relative flex flex-wrap items-end justify-between gap-6">
          <div>
            <Eyebrow className="text-eb-orange">client</Eyebrow>
            <p className="eb-price mt-1 font-display text-display-l">
              {formatPhone(c.phone)}
            </p>
            <p className="mt-1 text-body text-eb-cream">
              {c.first_name ?? 'Prénom non renseigné'}
            </p>
          </div>

          <div className="text-right">
            <Eyebrow className="text-eb-cream">solde</Eyebrow>
            <p className="eb-price font-display text-display-xl leading-none">
              {c.points_balance}
            </p>
          </div>
        </div>

        <div className="relative mt-6 flex flex-wrap gap-8">
          <Metric label="commandes" value={String(c.orders_count)} />
          <Metric label="dépense cumulée" value={`${Math.round(c.lifetime_spend / 100)} MAD`} />
          <Metric
            label="dernière visite"
            value={
              c.last_order_at
                ? new Date(c.last_order_at).toLocaleDateString('fr-FR')
                : '—'
            }
          />
          <Metric
            label="client depuis"
            value={new Date(c.created_at).toLocaleDateString('fr-FR')}
          />
        </div>
      </section>

      {/* -------------------------------------------------- ajustement */}
      <section className="mt-8">
        <h2 className="mb-1 text-display-m">Ajuster les points</h2>
        {canAdjust ? (
          <>
            <p className="mb-4 max-w-lg text-body-s text-eb-grey">
              Créditer ou retirer des points à la main, indépendamment de la
              caisse et de Glovo. Le motif est obligatoire et l’opération est
              tracée dans le journal d’audit.
            </p>
            <AdjustPointsForm customerId={c.id} balance={c.points_balance} />
          </>
        ) : (
          <p className="bg-eb-cream px-4 py-3 text-body-s text-eb-grey">
            Seul un superadmin peut ajuster un solde. C’est volontaire : c’est
            le geste le plus sensible du programme.
          </p>
        )}
      </section>

      {/* ------------------------------------------------------ ledger */}
      <section className="mt-10">
        <h2 className="mb-1 text-display-m">Historique des points</h2>
        <p className="mb-4 text-body-s text-eb-grey">
          Le ledger fait foi. Le solde affiché plus haut n’en est qu’un cache,
          recalculable à tout moment.
        </p>

        {rows.length === 0 ? (
          <p className="bg-eb-cream px-5 py-8 text-center text-body text-eb-grey">
            Aucun mouvement de points.
          </p>
        ) : (
          <ul className="flex flex-col">
            {rows.map((row) => (
              <li
                key={row.id}
                className="flex items-baseline justify-between gap-4 border-b border-eb-line py-3"
              >
                <div className="min-w-0">
                  <p className="text-body">
                    {SOURCE_LABEL[row.source] ?? row.source}
                    {/* Pour une commande, on montre le numéro lisible ; l'UUID
                        interne n'aide personne au comptoir. */}
                    {(orderNumberOf(row) ?? row.source_ref) && (
                      <span className="eb-price text-eb-grey">
                        {' · '}
                        {orderNumberOf(row) ?? row.source_ref}
                      </span>
                    )}
                  </p>
                  <p className="text-body-s text-eb-grey">
                    {new Date(row.created_at).toLocaleString('fr-FR', {
                      dateStyle: 'short',
                      timeStyle: 'short',
                    })}
                    {row.amount_cents ? (
                      <>
                        {' · '}
                        <Price cents={row.amount_cents} />
                      </>
                    ) : null}
                    {row.note ? ` · ${row.note}` : ''}
                  </p>
                </div>

                <span
                  className={`eb-price shrink-0 text-body-l font-semibold ${
                    row.points > 0 ? 'text-eb-black' : 'text-eb-orange'
                  }`}
                >
                  {row.points > 0 ? '+' : ''}
                  {row.points}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  )
}

/** Le numéro lisible de la commande liée, quel que soit la forme renvoyée. */
function orderNumberOf(row: LoyaltyRow): string | null {
  const rel = row.orders
  if (!rel) return null
  return Array.isArray(rel) ? (rel[0]?.order_number ?? null) : rel.order_number
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <Eyebrow className="text-eb-cream">{label}</Eyebrow>
      <p className="eb-price mt-0.5 text-body-l font-semibold">{value}</p>
    </div>
  )
}
