'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { Reward } from '@/lib/rewards'
import { redeemReward } from '@/app/actions/rewards'
import { RewardSticker } from '@/components/ui/RewardSticker'
import { Sheet } from '@/components/ui/Sheet'
import { Button } from '@/components/ui/Button'
import { Eyebrow } from '@/components/ui/Eyebrow'

/**
 * §9 — celles à portée en couleur, les autres en gris avec les points
 * manquants. On confirme avant d'échanger : les points partent tout de suite
 * et le code n'est valable que 15 minutes.
 */
export function RewardShop({
  rewards,
  balance,
}: {
  rewards: Reward[]
  balance: number
}) {
  const router = useRouter()
  const [picked, setPicked] = useState<Reward | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function confirm() {
    if (!picked) return
    setError(null)
    startTransition(async () => {
      const result = await redeemReward(picked.slug)
      if (!result.ok) return setError(result.error)
      setPicked(null)
      router.push(`/code/${result.id}`)
    })
  }

  return (
    <>
      <div className="mt-5 grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3">
        {rewards.map((r) => {
          const reachable = balance >= r.points_cost
          return (
            <button
              key={r.id}
              type="button"
              disabled={!reachable}
              onClick={() => {
                setError(null)
                setPicked(r)
              }}
              className="text-left disabled:cursor-default"
            >
              <RewardSticker
                title={r.title}
                pointsCost={r.points_cost}
                balance={balance}
                state={reachable ? 'available' : 'locked'}
              />
            </button>
          )
        })}
      </div>

      {error && !picked && (
        <p role="alert" className="mt-4 bg-eb-orange px-4 py-3 text-body text-eb-white">
          {error}
        </p>
      )}

      <Sheet
        open={picked !== null}
        onClose={() => setPicked(null)}
        title={picked?.title ?? ''}
        footer={
          <Button block size="lg" loading={pending} onClick={confirm}>
            Utiliser · {picked?.points_cost} points
          </Button>
        }
      >
        <Eyebrow className="text-eb-grey">ce qui va se passer</Eyebrow>
        <p className="mt-2 text-body-l">
          {picked?.points_cost} points sont retirés tout de suite, et tu reçois
          un code à 6 chiffres à montrer au comptoir.
        </p>
        <p className="mt-3 text-body-s text-eb-grey">
          Le code est valable 15 minutes. Passé ce délai, il ne marche plus —
          mais tes points te sont rendus automatiquement.
        </p>
        <p className="mt-3 text-body-s text-eb-grey">
          Solde après échange : {balance - (picked?.points_cost ?? 0)} points.
        </p>

        {error && (
          <p role="alert" className="mt-4 bg-eb-orange px-4 py-3 text-body text-eb-white">
            {error}
          </p>
        )}
      </Sheet>
    </>
  )
}
