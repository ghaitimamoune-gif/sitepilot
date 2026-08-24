'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Product } from '@/types/db'
import { useCart } from '@/lib/cart'
import { formatMAD } from '@/lib/money'
import { Button } from '@/components/ui/Button'
import { Eyebrow } from '@/components/ui/Eyebrow'
import { Price } from '@/components/ui/Price'
import { cn } from '@/lib/cn'

/**
 * Choix des options et ajout au panier (§9).
 *
 * Le prix affiché se met à jour en temps réel, mais il reste indicatif :
 * place_order recalcule tout en base. Ici on optimise la confiance du
 * client, pas la sécurité — celle-ci est ailleurs.
 */
export function ProductForm({ product }: { product: Product }) {
  const router = useRouter()
  const { add } = useCart()
  // Mémorisé : sans ça, `?? []` crée un nouveau tableau à chaque rendu et
  // relance le calcul du prix en boucle.
  const options = useMemo(() => product.options ?? [], [product.options])

  // option_id → identifiants de valeurs sélectionnées
  const [selected, setSelected] = useState<Record<string, string[]>>(() => {
    const initial: Record<string, string[]> = {}
    for (const o of options) {
      // Un choix obligatoire est présélectionné sur sa première valeur :
      // personne ne doit pouvoir arriver en bas de page bloqué sans le
      // comprendre.
      initial[o.id] = o.is_required && o.values[0] ? [o.values[0].id] : []
    }
    return initial
  })
  const [qty, setQty] = useState(1)

  const chosen = useMemo(() => {
    const list: { id: string; name: string; priceDeltaCents: number }[] = []
    for (const o of options) {
      for (const id of selected[o.id] ?? []) {
        const v = o.values.find((x) => x.id === id)
        if (v) list.push({ id: v.id, name: v.name, priceDeltaCents: v.price_delta_cents })
      }
    }
    return list
  }, [options, selected])

  const unitCents = Math.max(
    0,
    product.price_cents + chosen.reduce((n, o) => n + o.priceDeltaCents, 0),
  )

  const missing = options.filter(
    (o) => o.is_required && (selected[o.id] ?? []).length === 0,
  )

  function toggle(option: Product['options'] extends undefined ? never : NonNullable<Product['options']>[number], valueId: string) {
    setSelected((prev) => {
      const current = prev[option.id] ?? []
      if (option.type === 'single') {
        return { ...prev, [option.id]: [valueId] }
      }
      return {
        ...prev,
        [option.id]: current.includes(valueId)
          ? current.filter((v) => v !== valueId)
          : [...current, valueId],
      }
    })
  }

  function addToCart() {
    add({
      productId: product.id,
      slug: product.slug,
      name: product.name,
      imageUrl: product.image_url,
      unitPriceCents: unitCents,
      qty,
      options: chosen,
    })
    router.push('/panier')
  }

  return (
    <div className="px-4 pb-8">
      {options.map((option) => (
        <fieldset key={option.id} className="mt-8 border-t border-eb-line pt-5">
          <legend className="sr-only">{option.name}</legend>

          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-display-m">{option.name}</h2>
            <Eyebrow className="text-eb-grey">
              {option.is_required
                ? 'obligatoire'
                : option.type === 'multi'
                  ? 'plusieurs choix'
                  : 'facultatif'}
            </Eyebrow>
          </div>

          <ul className="flex flex-col">
            {option.values.map((value) => {
              const isOn = (selected[option.id] ?? []).includes(value.id)
              return (
                <li key={value.id}>
                  <label
                    className={cn(
                      'flex min-h-touch cursor-pointer items-center justify-between gap-3',
                      'border-b border-eb-line py-3',
                    )}
                  >
                    <span className="flex items-center gap-3">
                      <input
                        type={option.type === 'single' ? 'radio' : 'checkbox'}
                        name={option.id}
                        checked={isOn}
                        onChange={() => toggle(option, value.id)}
                        className="h-5 w-5 accent-[color:var(--eb-orange)]"
                      />
                      <span className="text-body-l">{value.name}</span>
                    </span>

                    {value.price_delta_cents !== 0 && (
                      <Price
                        cents={value.price_delta_cents}
                        className="text-body text-eb-grey"
                      />
                    )}
                  </label>
                </li>
              )
            })}
          </ul>
        </fieldset>
      ))}

      <div className="mt-8 flex items-center gap-4">
        <QtyStepper value={qty} onChange={setQty} />
        <Button
          block
          size="lg"
          onClick={addToCart}
          disabled={missing.length > 0}
        >
          {missing.length > 0
            ? `Choisis : ${missing.map((o) => o.name.toLowerCase()).join(', ')}`
            : `Ajouter · ${formatMAD(unitCents * qty)}`}
        </Button>
      </div>
    </div>
  )
}

function QtyStepper({
  value,
  onChange,
}: {
  value: number
  onChange: (n: number) => void
}) {
  return (
    <div className="flex h-14 shrink-0 items-center border border-eb-line">
      <button
        type="button"
        onClick={() => onChange(Math.max(1, value - 1))}
        disabled={value <= 1}
        aria-label="Retirer un"
        className="h-full w-11 text-body-l disabled:opacity-30"
      >
        −
      </button>
      <span
        aria-live="polite"
        className="eb-price w-8 text-center text-body-l font-semibold"
      >
        {value}
      </span>
      <button
        type="button"
        onClick={() => onChange(Math.min(50, value + 1))}
        aria-label="Ajouter un"
        className="h-full w-11 text-body-l"
      >
        +
      </button>
    </div>
  )
}
