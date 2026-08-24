import { forwardRef } from 'react'
import type { ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

/**
 * §4.1 — l'orange signale l'action ou la récompense, jamais la décoration,
 * et `#FF421D` ne passe pas les seuils de contraste en texte courant sur
 * fond clair. Il n'existe donc AUCUNE variante « texte orange sur fond
 * clair » dans cette API : la règle est appliquée par le typage, pas par
 * la discipline de celui qui écrit l'écran.
 *
 * §4.3 — rayon 8px, réservé aux boutons.
 * §4.5 — pas de dégradé, pas d'ombre portée.
 */
const VARIANTS = {
  /** L'action principale de l'écran. Un seul aplat orange par écran (§4.1). */
  primary: 'bg-eb-orange text-eb-white active:bg-eb-black',
  /** Action forte non prioritaire. */
  dark: 'bg-eb-black text-eb-white active:bg-eb-orange',
  /** Action secondaire. */
  outline:
    'bg-eb-white text-eb-black border border-eb-line active:bg-eb-cream',
  /** Action tertiaire, discrète. */
  quiet: 'bg-transparent text-eb-grey active:text-eb-black',
} as const

const SIZES = {
  /** Barre d'action collante en bas d'écran. */
  lg: 'h-14 px-6 text-body-l',
  md: 'h-touch px-5 text-body',
  sm: 'h-9 px-3.5 text-body-s',
} as const

export type ButtonVariant = keyof typeof VARIANTS
export type ButtonSize = keyof typeof SIZES

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  size?: ButtonSize
  block?: boolean
  loading?: boolean
}

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  {
    variant = 'primary',
    size = 'md',
    block = false,
    loading = false,
    disabled,
    className,
    children,
    ...rest
  },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-button',
        'font-sans font-semibold',
        'transition-colors duration-100',
        'disabled:cursor-not-allowed',
        // Délavé seulement si le bouton est réellement inactif :
        // pendant un chargement, on doit encore voir sur quoi on a appuyé.
        disabled && !loading && 'opacity-40',
        VARIANTS[variant],
        SIZES[size],
        block && 'w-full',
        className,
      )}
      {...rest}
    >
      {loading ? <Spinner /> : children}
    </button>
  )
})

function Spinner() {
  return (
    <span
      aria-hidden
      className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
    />
  )
}
