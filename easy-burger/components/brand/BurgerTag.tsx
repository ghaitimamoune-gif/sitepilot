import { cn } from '@/lib/cn'

/** Ratio du mot « burger » pivoté, relevé dans le fichier de marque. */
const RATIO = 115 / 497

type Props = {
  ink?: 'noir' | 'blanc' | 'orange'
  /** Hauteur en px. */
  height?: number
  className?: string
}

/**
 * Le mot « burger » pivoté à 90°, collé au wordmark dans l'identité (§4.3.2).
 * Réutilisé ici comme micro-étiquette verticale en marge de section.
 */
export function BurgerTag({ ink = 'noir', height = 64, className }: Props) {
  const w = Math.round(height * RATIO * 100) / 100

  return (
    // eslint-disable-next-line @next/next/no-img-element -- cf. Logo.tsx
    <img
      src={`/logo/burger-tag-${ink}.svg`}
      alt=""
      aria-hidden
      width={w}
      height={height}
      style={{ width: w, height }}
      className={cn('block select-none', className)}
      draggable={false}
    />
  )
}
