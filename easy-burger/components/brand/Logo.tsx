import { cn } from '@/lib/cn'
import type { LogoVariant } from '@/types'

/** Ratio du wordmark complet, relevé dans le fichier de marque : 1578 × 504. */
const RATIO = 1578 / 504

/** §4.0 — taille minimale à l'écran : 88 px de large. */
export const LOGO_MIN_WIDTH = 88

type Props = {
  variant?: LogoVariant
  /** Largeur en px. Jamais en dessous de 88 (§4.0). */
  width?: number
  /** Zone de protection : une hauteur de « e » minuscule sur les 4 côtés. */
  clearspace?: boolean
  priority?: boolean
  className?: string
}

/**
 * Le logo Easy Burger.
 *
 * Cinq déclinaisons vectorielles, jamais retypographiées, jamais déformées,
 * jamais accompagnées d'un effet (§4.0 et §4.5). Le ratio est verrouillé par
 * le composant : il n'existe aucun moyen de l'étirer depuis l'extérieur.
 */
export function Logo({
  variant = 'noir',
  width = 160,
  clearspace = false,
  priority = false,
  className,
}: Props) {
  const w = Math.max(width, LOGO_MIN_WIDTH)
  const h = Math.round((w / RATIO) * 100) / 100
  // La hauteur du « e » minuscule vaut environ 38 % de la hauteur du bloc.
  const pad = clearspace ? Math.round(h * 0.38) : 0

  return (
    <span
      className={cn('inline-block align-middle', className)}
      style={pad ? { padding: pad } : undefined}
    >
      {/* eslint-disable-next-line @next/next/no-img-element --
          SVG à tracés purs : rien à optimiser, et <Image> refuse le SVG
          sans `dangerouslyAllowSVG`. Le service worker le met en cache. */}
      <img
        src={`/logo/easy-burger-${variant}.svg`}
        alt="Easy Burger"
        width={w}
        height={h}
        style={{ width: w, height: h, display: 'block' }}
        fetchPriority={priority ? 'high' : undefined}
        draggable={false}
      />
    </span>
  )
}
