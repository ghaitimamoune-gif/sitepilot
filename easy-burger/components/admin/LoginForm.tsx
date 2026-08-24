'use client'

import { useActionState } from 'react'
import { signIn } from '@/app/actions/staff'
import { Field } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'

export function LoginForm() {
  const [state, action, pending] = useActionState(signIn, null)

  return (
    <form action={action} className="flex flex-col gap-5">
      <Field label="e-mail" name="email" type="email" autoComplete="email" required />
      <Field
        label="mot de passe"
        name="password"
        type="password"
        autoComplete="current-password"
        required
      />

      {state && !state.ok && (
        <p role="alert" className="bg-eb-orange px-4 py-3 text-body text-eb-white">
          {state.error}
        </p>
      )}

      <Button type="submit" block size="lg" loading={pending}>
        Se connecter
      </Button>
    </form>
  )
}
