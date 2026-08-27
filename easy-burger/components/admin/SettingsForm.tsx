'use client'

import { useActionState } from 'react'
import { updateSettings } from '@/app/actions/admin'
import { Button } from '@/components/ui/Button'
import { Eyebrow } from '@/components/ui/Eyebrow'

type Setting = { key: string; value: unknown; label: string }

/**
 * Le type d'affichage se déduit du nom de la clé, pas d'une colonne en base :
 * un seuil en centimes doit se saisir en dirhams, un booléen être une case,
 * et un ratio un entier. Ajouter une clé `*_cents` la fait tomber toute
 * seule dans le bon champ.
 */
function kindOf(key: string, value: unknown): 'boolean' | 'money' | 'number' | 'string' {
  if (typeof value === 'boolean') return 'boolean'
  if (key.endsWith('_cents')) return 'money'
  if (typeof value === 'number') return 'number'
  return 'string'
}

export function SettingsForm({ settings }: { settings: Setting[] }) {
  const [state, action, pending] = useActionState(updateSettings, null)

  return (
    <form action={action} className="flex flex-col gap-5">
      {settings.map((s) => {
        const kind = kindOf(s.key, s.value)
        const id = `s-${s.key}`

        return (
          <div key={s.key} className="border-b border-eb-line pb-4">
            <input type="hidden" name={`t.${s.key}`} value={kind} />

            {kind === 'boolean' ? (
              <label className="flex items-start gap-3">
                <input
                  type="checkbox"
                  name={`s.${s.key}`}
                  defaultChecked={s.value === true}
                  className="mt-1 h-5 w-5 accent-[color:var(--eb-orange)]"
                />
                <span>
                  <span className="block text-body">{s.label}</span>
                  <span className="eb-eyebrow font-util text-eb-grey">{s.key}</span>
                </span>
              </label>
            ) : (
              <label htmlFor={id} className="flex flex-col gap-1.5">
                <span className="text-body">{s.label}</span>
                <input
                  id={id}
                  name={`s.${s.key}`}
                  inputMode={kind === 'string' ? 'text' : 'decimal'}
                  defaultValue={
                    kind === 'money'
                      ? String((s.value as number) / 100)
                      : s.value === null
                        ? ''
                        : String(s.value)
                  }
                  className="h-touch w-full border border-eb-line px-3 text-body-l"
                />
                <span className="eb-eyebrow font-util text-eb-grey">
                  {s.key}
                  {kind === 'money' ? ' · en dirhams' : ''}
                </span>
              </label>
            )}
          </div>
        )
      })}

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
        <Button type="submit" loading={pending}>
          Enregistrer les réglages
        </Button>
        <Eyebrow className="text-eb-grey">effet dans la minute</Eyebrow>
      </div>
    </form>
  )
}
