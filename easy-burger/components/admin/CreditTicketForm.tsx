'use client'

import { useActionState, useRef } from 'react'
import { creditTicket } from '@/app/actions/staff'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { Eyebrow } from '@/components/ui/Eyebrow'
import { formatPhone } from '@/lib/phone'

/**
 * §11.2 — saisie caisse, niveau 1.
 *
 * Aucune dépendance à Lacaisse.ma : le caissier lit le numéro de ticket sur
 * le ticket papier. Si Lacaisse ouvre un jour une API, elle remplacera cette
 * saisie sans rien changer au reste.
 */
export function CreditTicketForm() {
  const formRef = useRef<HTMLFormElement>(null)

  const [state, action, pending] = useActionState(
    async (prev: unknown, formData: FormData) => {
      const result = await creditTicket(prev, formData)
      if (result.ok) formRef.current?.reset()
      return result
    },
    null,
  )

  return (
    <>
      <form ref={formRef} action={action} className="flex flex-col gap-5">
        <Field
          label="téléphone du client"
          name="phone"
          type="tel"
          inputMode="tel"
          required
          autoFocus
          placeholder="06 12 34 56 78"
          hint="Si le numéro est inconnu, le compte est créé automatiquement."
        />

        <Field
          label="montant du ticket"
          name="amount"
          inputMode="decimal"
          required
          placeholder="74,50"
        />

        <Field
          label="numéro de ticket"
          name="ticket_ref"
          required
          placeholder="A-1042"
          hint="La casse et les tirets n’ont pas d’importance."
        />

        <Button type="submit" block size="lg" loading={pending}>
          Créditer
        </Button>
      </form>

      {state && (
        <div role="status" className="mt-6">
          {state.ok ? (
            <div className="bg-eb-orange px-5 py-6 text-eb-white">
              <Eyebrow>points crédités</Eyebrow>
              <p className="eb-price font-display text-display-xl leading-none">
                +{state.pointsCredited}
              </p>
              <p className="mt-2 text-body">
                {formatPhone(state.phone)} · nouveau solde {state.newBalance} points
              </p>
              <p className="mt-1 text-body-s">
                Ticket {state.ticketRef}
                {state.customerCreated ? ' · nouveau client créé' : ''}
              </p>
            </div>
          ) : (
            <p className="bg-eb-black px-5 py-4 text-body text-eb-white">
              {state.error}
            </p>
          )}
        </div>
      )}
    </>
  )
}
