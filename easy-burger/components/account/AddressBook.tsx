'use client'

import { useActionState, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { addAddress, deleteAddress } from '@/app/actions/profile'
import type { Address } from '@/lib/customer'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { Eyebrow } from '@/components/ui/Eyebrow'

export function AddressBook({ addresses }: { addresses: Address[] }) {
  const router = useRouter()
  const [adding, setAdding] = useState(addresses.length === 0)
  const [pending, startTransition] = useTransition()

  const [state, action, submitting] = useActionState(
    async (prev: unknown, formData: FormData) => {
      const result = await addAddress(prev, formData)
      if (result.ok) {
        setAdding(false)
        router.refresh()
      }
      return result
    },
    null,
  )

  return (
    <div className="flex flex-col gap-4">
      {addresses.length > 0 && (
        <ul className="flex flex-col">
          {addresses.map((a) => (
            <li
              key={a.id}
              className="flex items-start justify-between gap-4 border-b border-eb-line py-3"
            >
              <div className="min-w-0">
                {a.label && <Eyebrow className="text-eb-grey">{a.label}</Eyebrow>}
                <p className="text-body-l">{a.street}</p>
                {a.details && <p className="text-body-s text-eb-grey">{a.details}</p>}
                {a.is_default && (
                  <Eyebrow className="text-eb-orange">par défaut</Eyebrow>
                )}
              </div>

              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    await deleteAddress(a.id)
                    router.refresh()
                  })
                }
                className="eb-eyebrow shrink-0 font-util text-eb-grey"
              >
                supprimer
              </button>
            </li>
          ))}
        </ul>
      )}

      {adding ? (
        <form action={action} className="flex max-w-sm flex-col gap-4">
          <Field label="nom de l’adresse" name="label" placeholder="Maison, bureau…" />
          <Field
            label="adresse"
            name="street"
            required
            placeholder="Rue, immeuble, quartier"
          />
          <Field label="précisions" name="details" placeholder="Étage, code, repère" />

          {state && !state.ok && (
            <p role="alert" className="bg-eb-orange px-4 py-3 text-body text-eb-white">
              {state.error}
            </p>
          )}

          <div className="flex items-center gap-3">
            <Button type="submit" loading={submitting}>
              Enregistrer l’adresse
            </Button>
            {addresses.length > 0 && (
              <button
                type="button"
                onClick={() => setAdding(false)}
                className="eb-eyebrow font-util text-eb-grey"
              >
                annuler
              </button>
            )}
          </div>
        </form>
      ) : (
        <Button variant="outline" className="w-fit" onClick={() => setAdding(true)}>
          Ajouter une adresse
        </Button>
      )}
    </div>
  )
}
