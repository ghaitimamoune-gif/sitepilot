import type { Metadata } from 'next'
import { CartView } from '@/components/cart/CartView'
import { getSetting } from '@/lib/settings'

export const metadata: Metadata = { title: 'Panier' }

export default async function CartPage() {
  const [deliveryFee, freeThreshold, minOrder] = await Promise.all([
    getSetting<number>('delivery_fee_cents'),
    getSetting<number>('free_delivery_threshold_cents'),
    getSetting<number>('min_order_cents'),
  ])

  return (
    <CartView
      deliveryFeeCents={deliveryFee ?? 0}
      freeDeliveryThresholdCents={freeThreshold ?? 0}
      minOrderCents={minOrder ?? 0}
    />
  )
}
