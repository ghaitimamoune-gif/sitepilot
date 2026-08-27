'use client'

import { useActionState } from 'react'
import { useRouter } from 'next/navigation'
import { generateClaimCodes } from '@/app/actions/glovo'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { Eyebrow } from '@/components/ui/Eyebrow'

export function GenerateCodesForm() {
  const router = useRouter()
  const [state, action, pending] = useActionState(
    async (prev: unknown, formData: FormData) => {
      const result = await generateClaimCodes(prev, formData)
      if (result.ok) router.refresh()
      return result
    },
    null,
  )

  return (
    <>
      <form action={action} className="flex flex-col gap-5">
        <Field
          label="nom du lot"
          name="batch"
          required
          placeholder="sacs-septembre"
          hint="Pour suivre le taux de scan lot par lot."
        />
        <Field
          label="nombre de codes"
          name="count"
          inputMode="numeric"
          required
          defaultValue="200"
        />
        <Field
          label="points par code"
          name="points"
          inputMode="numeric"
          required
          defaultValue="50"
          hint="50 points = 5 MAD de récompense. Assez pour donner envie, pas assez pour coûter cher."
        />
        <Button type="submit" loading={pending} className="w-fit">
          Générer le lot
        </Button>
      </form>

      {state && !state.ok && (
        <p role="alert" className="mt-4 bg-eb-orange px-4 py-3 text-body text-eb-white">
          {state.error}
        </p>
      )}

      {state?.ok && (
        <div className="mt-5">
          <Eyebrow className="text-eb-grey">
            {state.codes.length} codes — à copier pour l’imprimeur
          </Eyebrow>
          <textarea
            readOnly
            rows={8}
            value={state.codes.join('\n')}
            onFocus={(e) => e.currentTarget.select()}
            className="eb-price mt-2 w-full border border-eb-line p-3 text-body-s"
          />
        </div>
      )}
    </>
  )
}
