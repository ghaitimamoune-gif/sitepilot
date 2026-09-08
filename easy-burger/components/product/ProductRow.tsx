import { cn } from '@/lib/cn'
import { Price } from '@/components/ui/Price'
import { Eyebrow } from '@/components/ui/Eyebrow'

/**
 * La ligne produit, pour ce qui n'a pas encore de photo.
 *
 * §4.5 : « la photo de burger fait tout le travail émotionnel ». Sans photo,
 * une grande vignette vide fait exactement l'inverse — elle donne l'air d'un
 * site inachevé. Une ligne de texte assumée vaut mieux qu'un cadre vide, et
 * le jour où la photo arrive, le produit rejoint la grille tout seul.
 */
export function ProductRow({
  name,
  description,
  priceCents,
  available = true,
  className,
}: {
  name: string
  description?: string | null
  priceCents: number
  available?: boolean
  className?: string
}) {
  return (
    <article
      className={cn(
        'flex items-baseline justify-between gap-4 border-b border-eb-line py-3.5',
        !available && 'text-eb-grey',
        className,
      )}
    >
      <div className="min-w-0">
        <h3 className="font-display text-body-l uppercase leading-tight">{name}</h3>
        {description && (
          <p className="mt-0.5 text-body-s text-eb-grey">{description}</p>
        )}
        {!available && <Eyebrow className="text-eb-grey">épuisé</Eyebrow>}
      </div>

      <Price cents={priceCents} className="shrink-0 text-body-l font-semibold" />
    </article>
  )
}
