'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { cartToPayloadItems, useCart } from '@/lib/cart'
import { placeOrder } from '@/app/actions/order'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { Price } from '@/components/ui/Price'
import { Eyebrow } from '@/components/ui/Eyebrow'
import { formatMAD } from '@/lib/money'
import { formatPhone } from '@/lib/phone'
import { cn } from '@/lib/cn'

type Mode = 'delivery' | 'pickup'

type SavedAddress = {
  id: string
  label: string | null
  street: string
  details: string | null
  isDefault: boolean
}

/**
 * Checkout, paiement en espèces (Phase 1).
 *
 * §8 : on ne demande le téléphone qu'ici, au moment de valider — le menu
 * est consultable sans compte. Un client déjà identifié ne le ressaisit pas,
 * et le prénom n'est plus demandé ici : il l'est sur l'écran de suivi, après
 * la première commande réussie.
 *
 * §12 : le paiement en espèces est le premier adaptateur à exister, parce
 * que ce sera la part majoritaire des commandes au démarrage.
 */
export function CheckoutForm({
  deliveryFeeCents,
  freeDeliveryThresholdCents,
  knownPhone,
  knownName,
  addresses,
}: {
  deliveryFeeCents: number
  freeDeliveryThresholdCents: number
  knownPhone: string | null
  knownName: string | null
  addresses: SavedAddress[]
}) {
  const router = useRouter()
  const { lines, subtotalCents, clear, ready } = useCart()

  const [mode, setMode] = useState<Mode>('delivery')
  const [phone, setPhone] = useState(knownPhone ?? '')
  const [address, setAddress] = useState(() => {
    const preferred = addresses.find((a) => a.isDefault) ?? addresses[0]
    return preferred ? fullAddress(preferred) : ''
  })
  const [pickedAddress, setPickedAddress] = useState<string | null>(() => {
    const preferred = addresses.find((a) => a.isDefault) ?? addresses[0]
    return preferred?.id ?? null
  })
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  // Passe à `true` dès que la commande est enregistrée. Sans ce drapeau, le
  // vidage du panier ferait croire à un panier vide et renverrait le client
  // sur /panier au lieu de son suivi de commande — en course avec la
  // redirection légitime, donc de façon intermittente.
  const [placed, setPlaced] = useState(false)

  const emptyCart = ready && lines.length === 0 && !placed

  useEffect(() => {
    if (emptyCart) router.replace('/panier')
  }, [emptyCart, router])

  if (!ready || emptyCart) return <div className="min-h-[50dvh]" />

  const fee =
    mode === 'delivery'
      ? freeDeliveryThresholdCents > 0 && subtotalCents >= freeDeliveryThresholdCents
        ? 0
        : deliveryFeeCents
      : 0

  const total = subtotalCents + fee

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    startTransition(async () => {
      const result = await placeOrder({
        mode,
        phone,
        name: knownName ?? '',
        address: mode === 'delivery' ? address : undefined,
        note,
        items: cartToPayloadItems(lines),
      })

      if (!result.ok) {
        setError(result.error)
        return
      }

      setPlaced(true)
      clear()
      router.push(`/suivi/${result.token}`)
    })
  }

  return (
    <form onSubmit={submit} className="px-4 pt-6">
      <h1 className="mb-6 text-display-l">Commander</h1>

      {/* ------------------------------------------------------------ mode */}
      <fieldset className="mb-6">
        <legend className="eb-eyebrow mb-2 font-util text-eb-grey">
          comment tu récupères
        </legend>
        <div className="grid grid-cols-2 gap-2">
          <ModeButton
            active={mode === 'delivery'}
            onClick={() => setMode('delivery')}
            label="Livraison"
            detail={fee === 0 && mode === 'delivery' ? 'offerte' : formatMAD(deliveryFeeCents)}
          />
          <ModeButton
            active={mode === 'pickup'}
            onClick={() => setMode('pickup')}
            label="À emporter"
            detail="au comptoir"
          />
        </div>
      </fieldset>

      {/* -------------------------------------------------------- identité */}
      <div className="flex flex-col gap-5">
        {knownPhone ? (
          <div className="flex items-center justify-between border border-eb-line px-4 py-3">
            <div>
              <Eyebrow className="text-eb-grey">téléphone</Eyebrow>
              <p className="eb-price text-body-l">{formatPhone(knownPhone)}</p>
            </div>
            <Eyebrow className="text-eb-orange">tes points y sont</Eyebrow>
          </div>
        ) : (
          <Field
            label="téléphone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            required
            placeholder="06 12 34 56 78"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            hint="C’est ce numéro qui portera tes points. On te demandera ton prénom après."
          />
        )}

        {mode === 'delivery' && (
          <>
            {addresses.length > 0 && (
              <div className="flex flex-col gap-2">
                <Eyebrow className="text-eb-grey">adresses enregistrées</Eyebrow>
                <div className="flex flex-wrap gap-2">
                  {addresses.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => {
                        setPickedAddress(a.id)
                        setAddress(fullAddress(a))
                      }}
                      className={cn(
                        'border px-3 py-2 text-left text-body-s',
                        pickedAddress === a.id
                          ? 'border-eb-black bg-eb-black text-eb-white'
                          : 'border-eb-line text-eb-black',
                      )}
                    >
                      {a.label ?? a.street}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      setPickedAddress(null)
                      setAddress('')
                    }}
                    className={cn(
                      'border px-3 py-2 text-body-s',
                      pickedAddress === null
                        ? 'border-eb-black bg-eb-black text-eb-white'
                        : 'border-eb-line text-eb-black',
                    )}
                  >
                    Autre
                  </button>
                </div>
              </div>
            )}

            <Field
              label="adresse de livraison"
              required
              placeholder="Rue, immeuble, étage, quartier"
              value={address}
              onChange={(e) => {
                setPickedAddress(null)
                setAddress(e.target.value)
              }}
              hint="La course est assurée par Glovo."
            />
          </>
        )}

        <Field
          label="note pour la cuisine"
          placeholder="Sans oignons, sonner au 3e…"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>

      {/* ------------------------------------------------------- paiement */}
      <fieldset className="mt-8 border-t border-eb-line pt-5">
        <legend className="eb-eyebrow mb-2 font-util text-eb-grey">paiement</legend>
        <div className="flex items-center justify-between border border-eb-black px-4 py-3">
          <span className="text-body-l font-semibold">
            {mode === 'delivery' ? 'Espèces à la livraison' : 'Espèces au comptoir'}
          </span>
          <Eyebrow className="text-eb-grey">seul mode pour l’instant</Eyebrow>
        </div>
      </fieldset>

      {/* ---------------------------------------------------------- total */}
      <div className="mt-8 border-t border-eb-line pt-4">
        <Row label="Sous-total" cents={subtotalCents} />
        {mode === 'delivery' && <Row label="Livraison" cents={fee} />}
        <div className="mt-2 flex items-baseline justify-between border-t border-eb-line pt-3">
          <span className="font-display text-display-m uppercase">Total</span>
          <Price cents={total} className="text-display-m font-semibold" />
        </div>
      </div>

      {error && (
        <p role="alert" className="mt-5 bg-eb-orange px-4 py-3 text-body text-eb-white">
          {error}
        </p>
      )}

      <div className="mt-6">
        <Button type="submit" block size="lg" loading={pending}>
          Commander · {formatMAD(total)}
        </Button>
      </div>

      <p className="mt-4 pb-4 text-body-s text-eb-grey">
        En commandant, tu acceptes qu’on utilise ton numéro pour te tenir au
        courant de ta commande. Rien d’autre.
      </p>
    </form>
  )
}

function fullAddress(a: SavedAddress): string {
  return [a.street, a.details].filter(Boolean).join(' — ')
}

function ModeButton({
  active,
  onClick,
  label,
  detail,
}: {
  active: boolean
  onClick: () => void
  label: string
  detail: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'flex h-20 flex-col items-start justify-center gap-1 border px-4 text-left',
        active
          ? 'border-eb-black bg-eb-black text-eb-white'
          : 'border-eb-line bg-eb-white text-eb-black',
      )}
    >
      <span className="font-display text-body-l uppercase">{label}</span>
      <span className={cn('eb-eyebrow font-util', active ? 'text-eb-cream' : 'text-eb-grey')}>
        {detail}
      </span>
    </button>
  )
}

function Row({ label, cents }: { label: string; cents: number }) {
  return (
    <div className="flex items-baseline justify-between py-1.5">
      <span className="text-body text-eb-grey">{label}</span>
      <Price cents={cents} className="text-body" />
    </div>
  )
}
