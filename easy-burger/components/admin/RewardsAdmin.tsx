'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { updateReward } from '@/app/actions/admin'
import { Eyebrow } from '@/components/ui/Eyebrow'
import { Button } from '@/components/ui/Button'

type Reward = {
  id: string
  slug: string
  title: string
  points_cost: number
  is_active: boolean
}

export function RewardsAdmin({ rewards }: { rewards: Reward[] }) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)

  return (
    <>
      <ul className="mt-6 flex flex-col">
        {rewards.map((r) => (
          <li key={r.id} className="border-b border-eb-line py-3">
            <form
              action={async (formData) => {
                const result = await updateReward(null, formData)
                if (result.ok) router.refresh()
                else setError(result.error)
              }}
              className="flex flex-wrap items-end gap-3"
            >
              <input type="hidden" name="id" value={r.id} />

              <label className="flex min-w-[180px] flex-1 flex-col gap-1">
                <Eyebrow className="text-eb-grey">{r.slug}</Eyebrow>
                <input
                  name="title"
                  defaultValue={r.title}
                  className="h-touch w-full border border-eb-line px-3 text-body-l"
                />
              </label>

              <label className="flex w-28 flex-col gap-1">
                <Eyebrow className="text-eb-grey">points</Eyebrow>
                <input
                  name="points_cost"
                  inputMode="numeric"
                  defaultValue={r.points_cost}
                  className="eb-price h-touch w-full border border-eb-line px-3 text-body-l"
                />
              </label>

              <label className="flex h-touch items-center gap-2">
                <input
                  type="checkbox"
                  name="is_active"
                  defaultChecked={r.is_active}
                  className="h-5 w-5 accent-[color:var(--eb-orange)]"
                />
                <span className="eb-eyebrow font-util text-eb-grey">visible</span>
              </label>

              <Button type="submit" size="sm" variant="outline">
                Enregistrer
              </Button>
            </form>
          </li>
        ))}
      </ul>

      {error && (
        <p role="alert" className="mt-4 bg-eb-orange px-4 py-3 text-body text-eb-white">
          {error}
        </p>
      )}
    </>
  )
}
