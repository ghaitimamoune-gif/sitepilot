import { cn } from '@/lib/cn'
import { Eyebrow } from '@/components/ui/Eyebrow'
import type { OrderMode, OrderStatus } from '@/types/db'

/**
 * §9 — quatre états, pas un de plus : reçue → en préparation →
 * prête / en livraison → livrée.
 */
const STEPS: { key: OrderStatus; label: string; pickupLabel?: string }[] = [
  { key: 'received', label: 'Reçue' },
  { key: 'preparing', label: 'En préparation' },
  { key: 'delivering', label: 'En livraison', pickupLabel: 'Prête' },
  { key: 'completed', label: 'Livrée', pickupLabel: 'Récupérée' },
]

const ORDER: OrderStatus[] = ['received', 'preparing', 'ready', 'delivering', 'completed']

export function OrderStatusSteps({
  status,
  mode,
}: {
  status: OrderStatus
  mode: OrderMode
}) {
  if (status === 'cancelled') {
    return (
      <p className="mt-6 bg-eb-cream px-4 py-3 text-body text-eb-grey">
        Cette commande a été annulée. Appelle-nous si c’est une erreur.
      </p>
    )
  }

  const current = ORDER.indexOf(status)

  return (
    <ol className="mt-6 flex flex-col">
      {STEPS.map((step) => {
        // « prête » et « en livraison » occupent la même marche : en retrait
        // la commande est prête, en livraison elle est partie.
        const stepIndex = ORDER.indexOf(step.key === 'delivering' && mode === 'pickup' ? 'ready' : step.key)
        const done = current >= stepIndex
        const active = current === stepIndex

        return (
          <li
            key={step.key}
            className={cn(
              'flex items-center gap-3 border-b border-eb-line py-3',
              !done && 'opacity-40',
            )}
          >
            <span
              aria-hidden
              className={cn(
                'h-3 w-3 shrink-0',
                done ? 'bg-eb-orange' : 'border border-eb-grey',
              )}
            />
            <span className="font-display text-body-l uppercase">
              {mode === 'pickup' && step.pickupLabel ? step.pickupLabel : step.label}
            </span>
            {active && <Eyebrow className="ml-auto text-eb-orange">en cours</Eyebrow>}
          </li>
        )
      })}
    </ol>
  )
}
