import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import type { TrackedOrder } from '@/types/db'
import { Price } from '@/components/ui/Price'
import { Eyebrow } from '@/components/ui/Eyebrow'
import { EasyPattern } from '@/components/brand/EasyPattern'
import { OrderStatusSteps } from '@/components/order/OrderStatusSteps'
import { AskName } from '@/components/order/AskName'

export const metadata: Metadata = { title: 'Suivi de commande', robots: { index: false } }

// Le statut change en cuisine : on ne met jamais cette page en cache.
export const dynamic = 'force-dynamic'

export default async function TrackPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const supabase = await createClient()
  if (!supabase) notFound()

  const { data, error } = await supabase.rpc('get_order_by_token', { p_token: token })
  if (error || !data) notFound()

  const order = data as TrackedOrder

  return (
    <div className="px-4 pt-6">
      <section className="relative overflow-hidden bg-eb-black px-5 py-8 text-eb-white">
        <EasyPattern ink="blanc" opacity={0.07} scale={200} />
        <div className="relative">
          <Eyebrow className="text-eb-orange">commande enregistrée</Eyebrow>
          <p className="eb-price mt-1 font-display text-display-xl leading-none">
            {order.order_number}
          </p>
          <p className="mt-2 text-body text-eb-cream">
            {order.mode === 'delivery'
              ? 'Livraison par Glovo'
              : 'À récupérer au comptoir'}
            {order.contact_name ? ` · ${order.contact_name}` : ''}
          </p>
        </div>
      </section>

      {/* §9 : suivi volontairement simple. Pas de carte, pas de position
          coursier — c'est Glovo qui livre. */}
      <OrderStatusSteps status={order.status} mode={order.mode} />

      {order.needs_name && <AskName token={token} />}

      <section className="mt-8 border-t border-eb-line pt-5">
        <h2 className="mb-3 text-display-m">Détail</h2>
        <ul className="flex flex-col">
          {order.items.map((item, i) => (
            <li key={i} className="flex justify-between gap-3 border-b border-eb-line py-3">
              <div className="min-w-0">
                <p className="text-body-l">
                  <span className="eb-price font-semibold">{item.qty}×</span>{' '}
                  {item.name}
                </p>
                {item.options.length > 0 && (
                  <p className="text-body-s text-eb-grey">{item.options.join(' · ')}</p>
                )}
              </div>
              <Price cents={item.line_total_cents} className="shrink-0 text-body" />
            </li>
          ))}
        </ul>

        <div className="mt-4 flex items-baseline justify-between">
          <span className="text-body text-eb-grey">Sous-total</span>
          <Price cents={order.subtotal_cents} className="text-body" />
        </div>
        {order.delivery_fee_cents > 0 && (
          <div className="flex items-baseline justify-between">
            <span className="text-body text-eb-grey">Livraison</span>
            <Price cents={order.delivery_fee_cents} className="text-body" />
          </div>
        )}
        <div className="mt-2 flex items-baseline justify-between border-t border-eb-line pt-3">
          <span className="font-display text-display-m uppercase">Total</span>
          <Price cents={order.total_cents} className="text-display-m font-semibold" />
        </div>

        {order.address_snapshot && (
          <p className="mt-5 text-body-s text-eb-grey">
            Livraison à : {order.address_snapshot}
          </p>
        )}
        {order.note && (
          <p className="mt-1 text-body-s text-eb-grey">Note : {order.note}</p>
        )}
      </section>

      <p className="mt-8 pb-4 text-body-s text-eb-grey">
        Garde ce lien : c’est ta commande. Les points seront crédités sur ton
        numéro dès qu’elle sera terminée.
      </p>
    </div>
  )
}
