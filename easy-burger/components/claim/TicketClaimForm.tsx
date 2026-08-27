'use client'

import { useActionState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { submitTicketClaim } from '@/app/actions/glovo'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'

export function TicketClaimForm({ maxDays }: { maxDays: number }) {
  const router = useRouter()
  const formRef = useRef<HTMLFormElement>(null)

  const [state, action, pending] = useActionState(
    async (prev: unknown, formData: FormData) => {
      const result = await submitTicketClaim(prev, formData)
      if (result.ok) {
        formRef.current?.reset()
        router.refresh()
      }
      return result
    },
    null,
  )

  const today = new Date()
  const min = new Date(today.getTime() - maxDays * 86400000)
  const iso = (d: Date) => d.toISOString().slice(0, 10)

  return (
    <form ref={formRef} action={action} className="flex flex-col gap-5">
      <Field
        label="numéro de ticket"
        name="ticket_ref"
        required
        placeholder="A-1042"
        hint="En haut ou en bas du ticket."
      />
      <Field
        label="montant"
        name="amount"
        inputMode="decimal"
        required
        placeholder="74,50"
      />
      <Field
        label="date"
        name="ticket_date"
        type="date"
        required
        defaultValue={iso(today)}
        min={iso(min)}
        max={iso(today)}
      />

      {state && (
        <p
          role="alert"
          className={
            state.ok
              ? 'bg-eb-black px-4 py-3 text-body text-eb-white'
              : 'bg-eb-orange px-4 py-3 text-body text-eb-white'
          }
        >
          {state.ok
            ? `Ticket ${state.ticketRef} enregistré. On vérifie cette nuit et les points arrivent.`
            : state.error}
        </p>
      )}

      <Button type="submit" block size="lg" loading={pending}>
        Envoyer
      </Button>
    </form>
  )
}
