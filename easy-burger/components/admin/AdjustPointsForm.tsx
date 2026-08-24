'use client'

import { useActionState, useState } from 'react'
import { useRouter } from 'next/navigation'
import { adjustPoints } from '@/app/actions/staff'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { Eyebrow } from '@/components/ui/Eyebrow'

/**
 * §10 — ajustement manuel avec motif obligatoire.
 *
 * Le contrôle du rôle est fait par la fonction SQL : ce formulaire ne
 * s'affiche que pour un superadmin, mais même s'il était appelé autrement,
 * la base refuserait.
 */
export function AdjustPointsForm({
  customerId,
  balance,
}: {
  customerId: string
  balance: number
}) {
  const router = useRouter()
  const [points, setPoints] = useState('')
  const [state, action, pending] = useActionState(
    async (prev: unknown, formData: FormData) => {
      const result = await adjustPoints(prev, formData)
      if (result.ok) {
        setPoints('')
        router.refresh()
      }
      return result
    },
    null,
  )

  const delta = /^-?\d+$/.test(points) ? Number(points) : null
  const preview = delta === null ? null : balance + delta

  return (
    <form action={action} className="flex max-w-lg flex-col gap-4">
      <input type="hidden" name="customer_id" value={customerId} />

      <div className="flex flex-wrap gap-2">
        {[100, 250, -100].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setPoints(String(n))}
            className="eb-eyebrow h-9 border border-eb-line px-3 font-util text-eb-grey"
          >
            {n > 0 ? `+${n}` : n}
          </button>
        ))}
      </div>

      <Field
        label="points"
        name="points"
        inputMode="numeric"
        placeholder="250 — ou -100 pour retirer"
        value={points}
        onChange={(e) => setPoints(e.target.value)}
        required
        hint={
          preview === null
            ? undefined
            : preview < 0
              ? 'Le solde ne peut pas devenir négatif.'
              : `Nouveau solde : ${preview} points`
        }
      />

      <Field
        label="motif (obligatoire)"
        name="reason"
        required
        placeholder="Geste commercial — commande Glovo perdue"
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
          {state.ok ? state.message : state.error}
        </p>
      )}

      <div className="flex items-center gap-4">
        <Button type="submit" loading={pending} disabled={preview !== null && preview < 0}>
          Enregistrer l’ajustement
        </Button>
        <Eyebrow className="text-eb-grey">tracé dans l’audit</Eyebrow>
      </div>
    </form>
  )
}
