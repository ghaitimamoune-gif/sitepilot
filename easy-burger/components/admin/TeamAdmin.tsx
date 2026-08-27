'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { setStaffActive, setStaffRole } from '@/app/actions/admin'
import { ROLE_LABELS, ROLES } from '@/lib/roles'
import type { StaffRole } from '@/types/db'
import { Button } from '@/components/ui/Button'
import { Eyebrow } from '@/components/ui/Eyebrow'
import { cn } from '@/lib/cn'

type Member = {
  id: string
  name: string
  phone: string | null
  role: StaffRole
  is_active: boolean
  created_at: string
}

export function TeamAdmin({
  members,
  currentId,
}: {
  members: Member[]
  currentId: string
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null)
    startTransition(async () => {
      const r = await fn()
      if (!r.ok) setError(r.error ?? 'Échec')
      else router.refresh()
    })
  }

  return (
    <>
      <ul className="mt-6 flex flex-col">
        {members.map((m) => {
          // On ne peut pas se rétrograder ni se désactiver soi-même : ce
          // serait le moyen le plus simple de se verrouiller dehors.
          const isSelf = m.id === currentId

          return (
            <li
              key={m.id}
              className={cn(
                'flex flex-wrap items-center justify-between gap-3 border-b border-eb-line py-3',
                !m.is_active && 'opacity-50',
              )}
            >
              <div>
                <p className="text-body-l font-semibold">
                  {m.name}
                  {isSelf && <span className="text-eb-grey"> · toi</span>}
                </p>
                <Eyebrow className="text-eb-grey">
                  {ROLE_LABELS[m.role]}
                  {m.is_active ? '' : ' · désactivé'}
                </Eyebrow>
              </div>

              <div className="flex items-center gap-2">
                <select
                  defaultValue={m.role}
                  disabled={pending || isSelf}
                  onChange={(e) => run(() => setStaffRole(m.id, e.target.value))}
                  className="h-9 border border-eb-line px-2 text-body-s disabled:opacity-40"
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABELS[r]}
                    </option>
                  ))}
                </select>

                <Button
                  size="sm"
                  variant={m.is_active ? 'outline' : 'primary'}
                  disabled={pending || isSelf}
                  onClick={() => run(() => setStaffActive(m.id, !m.is_active))}
                >
                  {m.is_active ? 'Désactiver' : 'Réactiver'}
                </Button>
              </div>
            </li>
          )
        })}
      </ul>

      {error && (
        <p role="alert" className="mt-4 bg-eb-orange px-4 py-3 text-body text-eb-white">
          {error}
        </p>
      )}
    </>
  )
}
