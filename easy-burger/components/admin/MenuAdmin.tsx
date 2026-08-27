'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toggleProduct, updateProduct } from '@/app/actions/admin'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { Eyebrow } from '@/components/ui/Eyebrow'
import { Sheet } from '@/components/ui/Sheet'
import { formatMAD } from '@/lib/money'
import { cn } from '@/lib/cn'

type Product = {
  id: string
  name: string
  description: string | null
  price_cents: number
  image_url: string | null
  is_available: boolean
  sort_order: number
}

type Category = { id: string; name: string; sort_order: number; products: Product[] }

export function MenuAdmin({ categories }: { categories: Category[] }) {
  const router = useRouter()
  const [editing, setEditing] = useState<Product | null>(null)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  return (
    <>
      {categories.map((c) => (
        <section key={c.id} className="mt-8">
          <h2 className="mb-3 text-display-m">{c.name}</h2>
          <ul className="flex flex-col">
            {[...c.products]
              .sort((a, b) => a.sort_order - b.sort_order)
              .map((p) => (
                <li
                  key={p.id}
                  className="flex flex-wrap items-center justify-between gap-3 border-b border-eb-line py-3"
                >
                  <div className={cn('min-w-0', !p.is_available && 'opacity-50')}>
                    <p className="text-body-l font-semibold">{p.name}</p>
                    <p className="eb-price text-body-s text-eb-grey">
                      {formatMAD(p.price_cents)}
                      {p.image_url ? '' : ' · sans photo'}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant={p.is_available ? 'outline' : 'primary'}
                      disabled={pending}
                      onClick={() =>
                        startTransition(async () => {
                          const r = await toggleProduct(p.id, !p.is_available)
                          if (!r.ok) setError(r.error)
                          else router.refresh()
                        })
                      }
                    >
                      {p.is_available ? 'Marquer épuisé' : 'Remettre en vente'}
                    </Button>
                    <Button size="sm" variant="quiet" onClick={() => setEditing(p)}>
                      Modifier
                    </Button>
                  </div>
                </li>
              ))}
          </ul>
        </section>
      ))}

      {error && (
        <p role="alert" className="mt-4 bg-eb-orange px-4 py-3 text-body text-eb-white">
          {error}
        </p>
      )}

      <Sheet
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing?.name ?? ''}
      >
        {editing && (
          <form
            action={async (formData) => {
              const r = await updateProduct(null, formData)
              if (r.ok) {
                setEditing(null)
                router.refresh()
              } else setError(r.error)
            }}
            className="flex flex-col gap-4"
          >
            <input type="hidden" name="id" value={editing.id} />
            <Field label="nom" name="name" required defaultValue={editing.name} />
            <Field
              label="description"
              name="description"
              defaultValue={editing.description ?? ''}
            />
            <Field
              label="prix"
              name="price"
              inputMode="decimal"
              required
              defaultValue={formatMAD(editing.price_cents, { suffix: false })}
              hint="En dirhams. Stocké en centimes."
            />
            <Field
              label="photo"
              name="image_url"
              defaultValue={editing.image_url ?? ''}
              placeholder="/photos/cheeseburger.jpg"
            />
            <Eyebrow className="text-eb-grey">
              une commande déjà passée garde son ancien prix
            </Eyebrow>
            <Button type="submit" block size="lg">
              Enregistrer
            </Button>
          </form>
        )}
      </Sheet>
    </>
  )
}
