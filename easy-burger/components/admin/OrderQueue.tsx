'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { OrderRow, OrderStatus } from '@/types/db'
import { setOrderStatus } from '@/app/actions/staff'
import { Button } from '@/components/ui/Button'
import { Eyebrow } from '@/components/ui/Eyebrow'
import { Price } from '@/components/ui/Price'
import { cn } from '@/lib/cn'
import { formatPhone } from '@/lib/phone'

/** L'étape suivante pour chaque statut. Une seule décision par commande. */
const NEXT: Partial<Record<OrderStatus, { status: OrderStatus; label: string }>> = {
  received: { status: 'preparing', label: 'Lancer la préparation' },
  preparing: { status: 'ready', label: 'Marquer prête' },
  ready: { status: 'delivering', label: 'Partie en livraison' },
  delivering: { status: 'completed', label: 'Livrée' },
}

const STATUS_LABEL: Record<OrderStatus, string> = {
  received: 'Reçue',
  preparing: 'En préparation',
  ready: 'Prête',
  delivering: 'En livraison',
  completed: 'Terminée',
  cancelled: 'Annulée',
}

export function OrderQueue({ orders }: { orders: OrderRow[] }) {
  if (orders.length === 0) {
    return (
      <p className="bg-eb-cream px-5 py-10 text-center text-body text-eb-grey">
        Aucune commande aujourd’hui.
      </p>
    )
  }

  return (
    <ul className="flex flex-col gap-3">
      {orders.map((order) => (
        <OrderCard key={order.id} order={order} />
      ))}
    </ul>
  )
}

function OrderCard({ order }: { order: OrderRow }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const next = NEXT[order.status]
  const closed = order.status === 'completed' || order.status === 'cancelled'

  function move(status: OrderStatus, reason?: string) {
    setError(null)
    startTransition(async () => {
      const result = await setOrderStatus(order.id, status, reason)
      if (!result.ok) setError(result.error)
      else router.refresh()
    })
  }

  return (
    <li
      className={cn(
        'border p-4',
        closed ? 'border-eb-line opacity-60' : 'border-eb-black',
      )}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex items-baseline gap-3">
          <span className="eb-price font-display text-display-m">
            {order.order_number}
          </span>
          <Eyebrow
            className={
              order.status === 'cancelled' ? 'text-eb-grey' : 'text-eb-orange'
            }
          >
            {STATUS_LABEL[order.status]}
          </Eyebrow>
          <Eyebrow className="text-eb-grey">
            {order.mode === 'delivery' ? 'livraison' : 'à emporter'}
          </Eyebrow>
        </div>

        <Price cents={order.total_cents} className="text-body-l font-semibold" />
      </div>

      <p className="mt-1 text-body-s text-eb-grey">
        {new Date(order.placed_at).toLocaleTimeString('fr-FR', {
          hour: '2-digit',
          minute: '2-digit',
        })}
        {order.contact_name ? ` · ${order.contact_name}` : ''}
        {order.contact_phone ? ` · ${formatPhone(order.contact_phone)}` : ''}
      </p>

      <ul className="mt-3 flex flex-col gap-0.5">
        {order.order_items.map((item, i) => (
          <li key={i} className="text-body">
            <span className="eb-price font-semibold">{item.qty}×</span>{' '}
            {item.name_snapshot}
          </li>
        ))}
      </ul>

      {order.address_snapshot && (
        <p className="mt-2 text-body-s text-eb-grey">📍 {order.address_snapshot}</p>
      )}
      {order.note && (
        <p className="mt-1 bg-eb-cream px-3 py-2 text-body-s">Note : {order.note}</p>
      )}

      {error && (
        <p role="alert" className="mt-3 bg-eb-orange px-3 py-2 text-body-s text-eb-white">
          {error}
        </p>
      )}

      {!closed && (
        <div className="mt-4 flex flex-wrap gap-2">
          {next && (
            <Button size="sm" loading={pending} onClick={() => move(next.status)}>
              {next.label}
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => {
              const reason = window.prompt('Motif de l’annulation ?')
              if (reason !== null) move('cancelled', reason)
            }}
          >
            Annuler
          </Button>
        </div>
      )}
    </li>
  )
}
