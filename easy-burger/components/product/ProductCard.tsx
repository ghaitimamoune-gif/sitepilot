import Image from 'next/image'
import { cn } from '@/lib/cn'
import { Price } from '@/components/ui/Price'
import { Eyebrow } from '@/components/ui/Eyebrow'

type Props = {
  name: string
  description?: string | null
  priceCents: number
  imageUrl?: string | null
  available?: boolean
  /** Mise en avant : photo 4/3 pleine largeur, nom et prix sur la même ligne. */
  featured?: boolean
  /** Rendu en <a> par l'appelant (Phase 1) : ici le composant reste passif. */
  className?: string
}

/**
 * La carte produit — §9, « produits en grandes vignettes photo ».
 *
 * §4.5 : la photo de burger fait tout le travail émotionnel, l'interface
 * autour doit être silencieuse. Donc pas de bordure décorative, pas d'ombre,
 * pas de coin arrondi. Une photo, un nom, un prix.
 *
 * Deux mises en page, parce qu'une seule ne tient pas : en grille deux
 * colonnes sur un téléphone, un nom en display sur trois lignes et un prix
 * sur la même ligne se chevauchent. Le prix passe donc en dessous.
 */
export function ProductCard({
  name,
  description,
  priceCents,
  imageUrl,
  available = true,
  featured = false,
  className,
}: Props) {
  return (
    <article
      className={cn(
        'flex w-full flex-col gap-2 text-left',
        // Le libellé « épuisé » doit rester lisible : on grise le texte,
        // pas le bloc entier (sinon on grise aussi le voile qui le porte).
        !available && 'text-eb-grey',
        className,
      )}
    >
      <div
        className={cn(
          'relative w-full overflow-hidden bg-eb-cream',
          featured ? 'aspect-[4/3]' : 'aspect-square',
          !available && 'grayscale',
        )}
      >
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={name}
            fill
            sizes={featured ? '(max-width: 640px) 100vw, 640px' : '(max-width: 640px) 50vw, 320px'}
            className="object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <Eyebrow className="text-eb-grey">photo à venir</Eyebrow>
          </div>
        )}

        {!available && (
          <div className="absolute inset-0 flex items-center justify-center bg-eb-black/75">
            <Eyebrow className="text-eb-white">épuisé</Eyebrow>
          </div>
        )}
      </div>

      {featured ? (
        <div className="flex items-baseline justify-between gap-4">
          <h3 className="text-display-m">{name}</h3>
          <Price cents={priceCents} className="shrink-0 text-body-l font-semibold" />
        </div>
      ) : (
        <div className="flex flex-col gap-0.5">
          <h3 className="font-display text-body-l uppercase leading-tight">{name}</h3>
          <Price cents={priceCents} className="text-body font-semibold" />
        </div>
      )}

      {description && <p className="text-body-s text-eb-grey">{description}</p>}
    </article>
  )
}
