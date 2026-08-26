'use client'

import { useActionState, useRef } from 'react'
import { consumeRewardCode } from '@/app/actions/rewards'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { Eyebrow } from '@/components/ui/Eyebrow'
import { formatPhone } from '@/lib/phone'

/**
 * §6.5 — validation du code de récompense au comptoir.
 *
 * Le code est marqué consommé côté serveur, dans la même transaction que sa
 * vérification : deux caissiers qui tapent le même code en même temps, un
 * seul passe.
 */
export function ConsumeCodeForm() {
  const formRef = useRef<HTMLFormElement>(null)

  const [state, action, pending] = useActionState(
    async (prev: unknown, formData: FormData) => {
      const result = await consumeRewardCode(prev, formData)
      if (result.ok) formRef.current?.reset()
      return result
    },
    null,
  )

  return (
    <>
      <form ref={formRef} action={action} className="flex flex-col gap-5">
        <Field
          label="code de récompense"
          name="code"
          inputMode="numeric"
          maxLength={6}
          required
          placeholder="408271"
          className="eb-price text-center text-display-m tracking-[0.3em]"
        />
        <Button type="submit" block size="lg" variant="dark" loading={pending}>
          Valider la récompense
        </Button>
      </form>

      {state && (
        <div role="status" className="mt-5">
          {state.ok ? (
            <div className="bg-eb-orange px-5 py-6 text-eb-white">
              <Eyebrow>récompense validée</Eyebrow>
              <p className="font-display text-display-l uppercase">{state.title}</p>
              <p className="eb-price mt-1 text-body">{formatPhone(state.phone)}</p>
              <p className="mt-2 text-body-s">Sers-la, c’est offert.</p>
            </div>
          ) : (
            <p className="bg-eb-black px-5 py-4 text-body text-eb-white">{state.error}</p>
          )}
        </div>
      )}
    </>
  )
}
