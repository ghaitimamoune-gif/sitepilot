'use client'

import { useState, useTransition } from 'react'
import { signOutCustomer } from '@/app/actions/auth'
import { deleteAccount } from '@/app/actions/profile'
import { Button } from '@/components/ui/Button'

/** §13 — désinscription en un clic, suppression de compte accessible. */
export function DangerZone() {
  const [confirming, setConfirming] = useState(false)
  const [pending, startTransition] = useTransition()

  return (
    <div className="mt-3 flex flex-col gap-6">
      <form action={signOutCustomer}>
        <Button variant="outline" type="submit" className="w-fit">
          Se déconnecter
        </Button>
      </form>

      {confirming ? (
        <div className="border border-eb-orange p-4">
          <p className="text-body">
            La suppression efface ta fiche, tes adresses et tes{' '}
            <strong>points</strong>. C’est définitif.
          </p>
          <p className="mt-2 text-body-s text-eb-grey">
            Tes commandes passées sont conservées pour la comptabilité, mais
            vidées de tes données personnelles.
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button
              loading={pending}
              onClick={() => startTransition(() => deleteAccount())}
            >
              Supprimer définitivement
            </Button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="eb-eyebrow font-util text-eb-grey"
            >
              annuler
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="eb-eyebrow w-fit font-util text-eb-grey underline"
        >
          supprimer mon compte
        </button>
      )}
    </div>
  )
}
