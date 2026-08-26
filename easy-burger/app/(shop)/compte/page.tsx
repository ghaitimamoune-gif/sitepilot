import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCurrentCustomer, getMyAddresses, getMyOrders } from '@/lib/customer'
import { formatPhone } from '@/lib/phone'
import { Eyebrow } from '@/components/ui/Eyebrow'
import { Price } from '@/components/ui/Price'
import { ProfileForm } from '@/components/account/ProfileForm'
import { AddressBook } from '@/components/account/AddressBook'
import { DangerZone } from '@/components/account/DangerZone'
import type { OrderStatus } from '@/types/db'

export const metadata: Metadata = { title: 'Compte' }
export const dynamic = 'force-dynamic'

const STATUS_LABEL: Record<OrderStatus, string> = {
  received: 'Reçue',
  preparing: 'En préparation',
  ready: 'Prête',
  delivering: 'En livraison',
  completed: 'Terminée',
  cancelled: 'Annulée',
}

export default async function AccountPage() {
  const customer = await getCurrentCustomer()
  if (!customer) redirect('/connexion?suite=%2Fcompte')

  const [addresses, orders] = await Promise.all([getMyAddresses(), getMyOrders()])

  return (
    <div className="px-4 pt-6">
      <h1 className="text-display-l">Compte</h1>
      <p className="eb-price mt-1 text-body-l text-eb-grey">
        {formatPhone(customer.phone)}
      </p>

      <section className="mt-8 border-t border-eb-line pt-6">
        <h2 className="mb-4 text-display-m">Profil</h2>
        <ProfileForm
          firstName={customer.first_name}
          birthdate={customer.birthdate ?? null}
          birthdateLocked={Boolean(customer.birthdate)}
          marketingConsent={Boolean(customer.marketing_consent)}
        />
      </section>

      <section className="mt-10 border-t border-eb-line pt-6">
        <h2 className="mb-1 text-display-m">Adresses</h2>
        <p className="mb-4 text-body-s text-eb-grey">
          Pour aller plus vite au moment de commander.
        </p>
        <AddressBook addresses={addresses} />
      </section>

      <section className="mt-10 border-t border-eb-line pt-6">
        <h2 className="mb-4 text-display-m">Mes commandes</h2>

        {orders.length === 0 ? (
          <p className="bg-eb-cream px-5 py-8 text-center text-body text-eb-grey">
            Aucune commande pour l’instant.
          </p>
        ) : (
          <ul className="flex flex-col">
            {orders.map((order) => (
              <li key={order.id} className="border-b border-eb-line py-3">
                <Link
                  href={order.public_token ? `/suivi/${order.public_token}` : '/compte'}
                  className="flex items-baseline justify-between gap-4"
                >
                  <div className="min-w-0">
                    <p className="eb-price text-body-l font-semibold">
                      {order.order_number}
                    </p>
                    <p className="text-body-s text-eb-grey">
                      {new Date(order.placed_at).toLocaleDateString('fr-FR', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                      {' · '}
                      {STATUS_LABEL[order.status]}
                      {' · '}
                      {order.order_items.reduce((n, i) => n + i.qty, 0)} article
                      {order.order_items.reduce((n, i) => n + i.qty, 0) > 1 ? 's' : ''}
                    </p>
                  </div>
                  <Price cents={order.total_cents} className="shrink-0 text-body" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-10 border-t border-eb-line pt-6">
        <Eyebrow className="text-eb-grey">session et données</Eyebrow>
        <DangerZone />
      </section>
    </div>
  )
}
