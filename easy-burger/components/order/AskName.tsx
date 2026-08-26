'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { nameCustomer } from '@/app/actions/order'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'

/**
 * §8 — « Prénom demandé après la première commande réussie, pas avant. »
 *
 * Le demander au checkout coûte un champ de plus au moment le plus fragile
 * du parcours. Ici, la commande est déjà passée : le client n'a plus rien à
 * perdre à répondre, et on peut l'appeler par son prénom la fois d'après.
 */
export function AskName({ token }: { token: string }) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [pending, startTransition] = useTransition()

  if (done) return null

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        setError(null)
        startTransition(async () => {
          const result = await nameCustomer(token, name)
          if (!result.ok) return setError(result.error)
          setDone(true)
          router.refresh()
        })
      }}
      className="mt-6 border border-eb-line p-4"
    >
      <h2 className="text-display-m">Comment on t’appelle&nbsp;?</h2>
      <p className="mt-1 text-body-s text-eb-grey">
        Pour te reconnaître au comptoir, et rien d’autre.
      </p>

      <div className="mt-4 flex items-end gap-3">
        <Field
          label="prénom"
          autoComplete="given-name"
          required
          placeholder="Yasmine"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="flex-1"
        />
        <Button type="submit" size="lg" loading={pending} disabled={name.trim() === ''}>
          Enregistrer
        </Button>
      </div>

      {error && (
        <p role="alert" className="mt-3 bg-eb-orange px-3 py-2 text-body-s text-eb-white">
          {error}
        </p>
      )}
    </form>
  )
}
