import { cn } from '@/lib/cn'
import { Eyebrow } from './Eyebrow'

export type RewardState = 'available' | 'locked' | 'used'

type Props = {
  title: string
  pointsCost: number
  /** Solde du client. Sert à calculer les points manquants. */
  balance?: number
  state?: RewardState
  className?: string
}

/**
 * Le sticker de récompense — §4.3.3.
 *
 * Dérivé du sticker orange « take it easy / take it smashy » du packaging.
 * Rayon 14px : RIEN D'AUTRE dans l'interface n'a ce rayon. Il est réservé
 * à ce qui a de la valeur, et c'est ce qui lui donne sa force.
 *
 *   available — orange plein, à portée
 *   locked    — gris, avec les points manquants (§9, écran Fidélité)
 *   used      — barré, consommé
 */
export function RewardSticker({
  title,
  pointsCost,
  balance,
  state = 'available',
  className,
}: Props) {
  const missing =
    state === 'locked' && balance !== undefined
      ? Math.max(pointsCost - balance, 0)
      : null

  return (
    <div
      className={cn(
        'relative inline-flex w-full max-w-[240px] flex-col gap-1 rounded-sticker px-4 py-3',
        '-rotate-2',
        state === 'available' && 'bg-eb-orange text-eb-white',
        state === 'locked' && 'bg-eb-cream text-eb-grey',
        state === 'used' && 'bg-eb-cream text-eb-grey line-through',
        className,
      )}
    >
      <Eyebrow className={state === 'available' ? 'text-eb-white' : 'text-eb-grey'}>
        {state === 'used' ? 'utilisée' : `${pointsCost} points`}
      </Eyebrow>

      <span className="font-display text-display-m uppercase">{title}</span>

      {missing !== null && (
        <span className="text-body-s">
          {missing === 0 ? 'à portée' : `encore ${missing} points`}
        </span>
      )}
    </div>
  )
}
