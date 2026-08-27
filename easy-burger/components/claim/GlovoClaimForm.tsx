'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { claimGlovoCode } from '@/app/actions/glovo'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { Eyebrow } from '@/components/ui/Eyebrow'
import { formatPhone } from '@/lib/phone'

export function GlovoClaimForm({ defaultCode }: { defaultCode: string }) {
  const [state, action, pending] = useActionState(claimGlovoCode, null)

  if (state?.ok) {
    return (
      <div className="bg-eb-orange px-5 py-8 text-eb-white">
        <Eyebrow>points crédités</Eyebrow>
        <p className="eb-price font-display text-[3.5rem] leading-none">
          +{state.points}
        </p>
        <p className="mt-2 text-body-l">
          {formatPhone(state.phone)} · nouveau solde {state.newBalance} points
        </p>
        <p className="mt-4 text-body-s">
          {state.created
            ? 'Ton compte est créé. Connecte-toi avec ce numéro pour voir tes points et commander en direct.'
            : 'Retrouve tes points dans l’onglet Fidélité.'}
        </p>
        <Link
          href="/connexion"
          className="mt-5 inline-block rounded-button bg-eb-white px-5 py-3 text-body font-semibold text-eb-black"
        >
          Voir mes points
        </Link>
      </div>
    )
  }

  return (
    <form action={action} className="flex flex-col gap-5">
      <Field
        label="code du sticker"
        name="code"
        required
        autoFocus={defaultCode === ''}
        defaultValue={defaultCode}
        placeholder="A7K2M9PQ"
        className="eb-price text-center text-display-m uppercase tracking-[0.2em]"
        hint="8 caractères, sans confusion possible entre O et 0."
      />

      <Field
        label="ton téléphone"
        name="phone"
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        required
        autoFocus={defaultCode !== ''}
        placeholder="06 12 34 56 78"
      />

      {state && !state.ok && (
        <p role="alert" className="bg-eb-black px-4 py-3 text-body text-eb-white">
          {state.error}
        </p>
      )}

      <Button type="submit" block size="lg" loading={pending}>
        Récupérer mes points
      </Button>
    </form>
  )
}
