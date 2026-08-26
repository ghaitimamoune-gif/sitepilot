import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getCurrentCustomer, getMyLedger, nextExpiry } from '@/lib/customer'
import { getSetting } from '@/lib/settings'
import { EasyPattern } from '@/components/brand/EasyPattern'
import { Eyebrow } from '@/components/ui/Eyebrow'
import { Price } from '@/components/ui/Price'
import { RewardSticker } from '@/components/ui/RewardSticker'
import { formatPhone } from '@/lib/phone'

export const metadata: Metadata = { title: 'Fidélité' }
export const dynamic = 'force-dynamic'

/**
 * Boutique de récompenses — §6.2.
 *
 * Les valeurs vivront en base (table `rewards`) en Phase 3. Ici elles ne
 * servent qu'à montrer la progression : rien n'est encore échangeable, et
 * l'écran le dit.
 */
const REWARDS = [
  { title: 'Sauce maison', points: 120 },
  { title: 'Soda', points: 200 },
  { title: 'Frites maison', points: 250 },
  { title: 'Beignets nutella', points: 400 },
  { title: 'Milkshake', points: 450 },
  { title: 'Cheeseburger', points: 600 },
  { title: 'Double cheese', points: 750 },
]

const SOURCE_LABEL: Record<string, string> = {
  app_order: 'Commande',
  pos_ticket: 'Au comptoir',
  glovo_code: 'Code Glovo',
  ticket_claim: 'Ticket réclamé',
  manual: 'Ajustement',
  welcome: 'Bienvenue',
  birthday: 'Anniversaire',
  reward: 'Récompense utilisée',
  expiry: 'Points expirés',
}

export default async function LoyaltyPage() {
  const customer = await getCurrentCustomer()
  if (!customer) redirect('/connexion?suite=%2Ffidelite')

  const [ledger, rate] = await Promise.all([
    getMyLedger(),
    getSetting<number>('redemption_rate'),
  ])

  const balance = customer.points_balance
  const expiry = nextExpiry(ledger)
  const next = REWARDS.find((r) => r.points > balance)
  const worthCents = Math.floor(balance / (rate ?? 10)) * 100

  return (
    <>
      {/* ------------------------------------------------ carte de fidélité */}
      <section className="relative overflow-hidden bg-eb-black px-5 py-9 text-eb-white">
        <EasyPattern ink="blanc" opacity={0.08} scale={190} />

        <div className="relative">
          <Eyebrow className="text-eb-orange">mon solde</Eyebrow>
          <p className="eb-price font-display text-[4.5rem] leading-[0.85]">
            {balance}
          </p>
          <p className="mt-1 text-body text-eb-cream">
            points · soit <Price cents={worthCents} /> de récompenses
          </p>

          {next && (
            <div className="mt-6">
              <div className="flex items-baseline justify-between">
                <Eyebrow className="text-eb-cream">
                  prochaine récompense · {next.title.toLowerCase()}
                </Eyebrow>
                <Eyebrow className="text-eb-orange">
                  encore {next.points - balance}
                </Eyebrow>
              </div>
              <div
                role="progressbar"
                aria-valuenow={balance}
                aria-valuemin={0}
                aria-valuemax={next.points}
                aria-label={`Progression vers ${next.title}`}
                className="mt-2 h-1.5 w-full bg-eb-grey/40"
              >
                <div
                  className="h-full bg-eb-orange"
                  style={{ width: `${Math.min(100, (balance / next.points) * 100)}%` }}
                />
              </div>
            </div>
          )}

          <p className="mt-6 text-body-s text-eb-cream">
            {formatPhone(customer.phone)}
          </p>
        </div>
      </section>

      {/* -------------------------------------------------- récompenses */}
      <section className="px-4 pt-8">
        <h2 className="text-display-l">Récompenses</h2>
        <p className="mt-1 text-body-s text-eb-grey">
          1 dirham dépensé = 1 point. {rate ?? 10} points = 1 dirham de
          récompense. Rien d’autre à retenir.
        </p>

        {/* §9 — grille photo : celles à portée en couleur, les autres en gris
            avec les points manquants. Deux colonnes sur téléphone, sinon la
            boutique s'étire sur trois écrans de haut. */}
        <div className="mt-5 grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3">
          {REWARDS.map((r) => (
            <RewardSticker
              key={r.title}
              title={r.title}
              pointsCost={r.points}
              balance={balance}
              state={balance >= r.points ? 'available' : 'locked'}
            />
          ))}
        </div>

        <p className="mt-6 bg-eb-cream px-4 py-3 text-body-s text-eb-grey">
          L’échange arrive très bientôt. Tes points, eux, sont déjà comptés —
          rien ne se perd.
        </p>
      </section>

      {/* --------------------------------------------------- expiration */}
      {expiry && (
        <section className="mt-8 px-4">
          <p className="border border-eb-line px-4 py-3 text-body-s text-eb-grey">
            {expiry.points} points expirent le{' '}
            {new Date(expiry.at).toLocaleDateString('fr-FR', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
            .
          </p>
        </section>
      )}

      {/* ---------------------------------------------------- historique */}
      <section className="mt-8 px-4">
        <h2 className="text-display-l">Historique</h2>

        {ledger.length === 0 ? (
          <p className="mt-4 bg-eb-cream px-5 py-8 text-center text-body text-eb-grey">
            Aucun point pour l’instant. Ta première commande en rapporte.
          </p>
        ) : (
          <ul className="mt-3 flex flex-col">
            {ledger.map((row) => (
              <li
                key={row.id}
                className="flex items-baseline justify-between gap-4 border-b border-eb-line py-3"
              >
                <div className="min-w-0">
                  <p className="text-body">{SOURCE_LABEL[row.source] ?? row.source}</p>
                  <p className="text-body-s text-eb-grey">
                    {new Date(row.created_at).toLocaleDateString('fr-FR', {
                      day: 'numeric',
                      month: 'short',
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
                    row.points > 0 ? 'text-eb-black' : 'text-eb-grey'
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
