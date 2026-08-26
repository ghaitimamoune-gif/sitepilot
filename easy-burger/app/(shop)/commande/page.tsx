import type { Metadata } from 'next'
import { CheckoutForm } from '@/components/cart/CheckoutForm'
import { getSetting } from '@/lib/settings'
import { getCurrentCustomer, getMyAddresses } from '@/lib/customer'

export const metadata: Metadata = { title: 'Commander' }
export const dynamic = 'force-dynamic'

export default async function CheckoutPage() {
  const [deliveryFee, freeThreshold, customer] = await Promise.all([
    getSetting<number>('delivery_fee_cents'),
    getSetting<number>('free_delivery_threshold_cents'),
    getCurrentCustomer(),
  ])

  // Le carnet d'adresses n'existe que pour un client identifié.
  const addresses = customer ? await getMyAddresses() : []

  return (
    <CheckoutForm
      deliveryFeeCents={deliveryFee ?? 0}
      freeDeliveryThresholdCents={freeThreshold ?? 0}
      knownPhone={customer?.phone ?? null}
      knownName={customer?.first_name ?? null}
      addresses={addresses.map((a) => ({
        id: a.id,
        label: a.label,
        street: a.street,
        details: a.details,
        isDefault: a.is_default,
      }))}
    />
  )
}
