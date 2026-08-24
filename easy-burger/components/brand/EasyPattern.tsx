import { cn } from '@/lib/cn'
import type { BrandInk } from '@/types'

type Props = {
  /** Encre du pavage. */
  ink?: BrandInk
  /** Opacité du motif. Il reste un fond : il ne doit jamais gêner la lecture. */
  opacity?: number
  /** Largeur d'une tuile en px. Plus petit = motif plus dense. */
  scale?: number
  className?: string
}

/**
 * Le pavage « easy » miroité — §4.3.1.
 *
 * Les mots répétés, alternés à l'endroit et retournés, comme le papier
 * d'emballage. C'est LA signature visuelle de l'app : fond de la carte de
 * fidélité, des écrans vides et de l'écran de chargement.
 *
 * Une seule tuile SVG, mise en cache par le service worker, répétée par CSS.
 * Aucun coût de rendu au-delà du premier téléchargement.
 */
export function EasyPattern({
  ink = 'noir',
  opacity = 0.06,
  scale = 220,
  className,
}: Props) {
  return (
    <div
      aria-hidden
      className={cn('pointer-events-none absolute inset-0', className)}
      style={{
        backgroundImage: `url(/pattern/easy-tile-${ink}.svg)`,
        backgroundRepeat: 'repeat',
        backgroundSize: `${scale}px auto`,
        opacity,
      }}
    />
  )
}
