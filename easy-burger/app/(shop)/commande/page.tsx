import type { Metadata } from 'next'
import { CheckoutForm } from '@/components/cart/CheckoutForm'
import { getSetting } from '@/lib/settings'

export const metadata: Metadata = { title: 'Commander' }

export default async function CheckoutPage() {
  const [deliveryFee, freeThreshold] = await Promise.all([
    getSetting<number>('delivery_fee_cents'),
    getSetting<number>('free_delivery_threshold_cents'),
  ])

  return (
    <CheckoutForm
      deliveryFeeCents={deliveryFee ?? 0}
      freeDeliveryThresholdCents={freeThreshold ?? 0}
    />
  )
}
