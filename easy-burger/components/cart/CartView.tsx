'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCart } from '@/lib/cart'
import { Button } from '@/components/ui/Button'
import { Price } from '@/components/ui/Price'
import { Eyebrow } from '@/components/ui/Eyebrow'
import { EasyPattern } from '@/components/brand/EasyPattern'
import { formatMAD } from '@/lib/money'

export function CartView({
  minOrderCents,
}: {
  deliveryFeeCents: number
  freeDeliveryThresholdCents: number
  minOrderCents: number
}) {
  const router = useRouter()
  const { lines, setQty, remove, subtotalCents, ready } = useCart()

  if (!ready) return <div className="min-h-[50dvh]" />

  if (lines.length === 0) {
    return (
      <section className="relative m-4 overflow-hidden bg-eb-cream px-5 py-16 text-center">
        <EasyPattern ink="orange" opacity={0.12} scale={200} />
        <div className="relative flex flex-col items-center gap-4">
          <Eyebrow className="text-eb-grey">panier vide</Eyebrow>
          <p className="text-body text-eb-grey">Il n’y a rien à commander pour l’instant.</p>
          <Link href="/" className="rounded-button bg-eb-orange px-5 py-3 text-body font-semibold text-eb-white">
            Voir le menu
          </Link>
        </div>
      </section>
    )
  }

  const belowMinimum = minOrderCents > 0 && subtotalCents < minOrderCents

  return (
    <div className="px-4 pt-6">
      <h1 className="mb-5 text-display-l">Panier</h1>

      <ul className="flex flex-col">
        {lines.map((line) => (
          <li
            key={line.key}
            className="flex gap-3 border-b border-eb-line py-4"
          >
            <div className="relative h-20 w-20 shrink-0 overflow-hidden bg-eb-cream">
              {line.imageUrl && (
                <Image
                  src={line.imageUrl}
                  alt=""
                  fill
                  sizes="80px"
                  className="object-cover"
                />
              )}
            </div>

            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="font-display text-body-l uppercase leading-tight">
                  {line.name}
                </h2>
                <Price
                  cents={line.unitPriceCents * line.qty}
                  className="shrink-0 text-body font-semibold"
                />
              </div>

              {line.options.length > 0 && (
                <p className="text-body-s text-eb-grey">
                  {line.options.map((o) => o.name).join(' · ')}
                </p>
              )}

              <div className="mt-1 flex items-center gap-3">
                <div className="flex items-center border border-eb-line">
                  <button
                    type="button"
                    onClick={() => setQty(line.key, line.qty - 1)}
                    aria-label={`Retirer un ${line.name}`}
                    className="h-9 w-9 text-body-l"
                  >
                    −
                  </button>
                  <span className="eb-price w-7 text-center text-body font-semibold">
                    {line.qty}
                  </span>
                  <button
                    type="button"
                    onClick={() => setQty(line.key, line.qty + 1)}
                    aria-label={`Ajouter un ${line.name}`}
                    className="h-9 w-9 text-body-l"
                  >
                    +
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => remove(line.key)}
                  className="eb-eyebrow font-util text-eb-grey"
                >
                  retirer
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-5 flex items-baseline justify-between">
        <span className="font-display text-display-m uppercase">Sous-total</span>
        <Price cents={subtotalCents} className="text-display-m font-semibold" />
      </div>
      <p className="mt-1 text-body-s text-eb-grey">
        Les frais de livraison sont calculés à l’étape suivante.
      </p>

      {belowMinimum && (
        <p className="mt-4 bg-eb-cream px-4 py-3 text-body-s text-eb-grey">
          Commande minimum : {formatMAD(minOrderCents)}. Il manque{' '}
          {formatMAD(minOrderCents - subtotalCents)}.
        </p>
      )}

      <div className="mt-6 flex flex-col gap-3">
        <Button
          block
          size="lg"
          disabled={belowMinimum}
          onClick={() => router.push('/commande')}
        >
          Commander · {formatMAD(subtotalCents)}
        </Button>
        <Link href="/" className="text-center text-body-s text-eb-grey">
          Ajouter autre chose
        </Link>
      </div>
    </div>
  )
}
