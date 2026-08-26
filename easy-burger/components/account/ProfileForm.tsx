'use client'

import { useActionState } from 'react'
import { updateProfile } from '@/app/actions/profile'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'

export function ProfileForm({
  firstName,
  birthdate,
  birthdateLocked,
  marketingConsent,
}: {
  firstName: string | null
  birthdate: string | null
  birthdateLocked: boolean
  marketingConsent: boolean
}) {
  const [state, action, pending] = useActionState(updateProfile, null)

  return (
    <form action={action} className="flex max-w-sm flex-col gap-5">
      <Field
        label="prénom"
        name="first_name"
        autoComplete="given-name"
        required
        defaultValue={firstName ?? ''}
        placeholder="Yasmine"
      />

      <Field
        label="date de naissance"
        name="birthdate"
        type="date"
        defaultValue={birthdate ?? ''}
        disabled={birthdateLocked}
        hint={
          birthdateLocked
            ? 'Déjà renseignée. Passe par le comptoir pour la corriger.'
            : 'Un dessert offert le jour J. Modifiable une seule fois.'
        }
      />

      <label className="flex items-start gap-3">
        <input
          type="checkbox"
          name="marketing_consent"
          defaultChecked={marketingConsent}
          className="mt-1 h-5 w-5 accent-[color:var(--eb-orange)]"
        />
        <span className="text-body">
          J’accepte de recevoir les offres Easy Burger.
          <span className="block text-body-s text-eb-grey">
            Les messages sur tes commandes te seront envoyés dans tous les cas.
          </span>
        </span>
      </label>

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

      <Button type="submit" loading={pending} className="w-fit">
        Enregistrer
      </Button>
    </form>
  )
}
