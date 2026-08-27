import { createClient } from '@/lib/supabase/server'
import { getStaffUser, isAtLeast } from '@/lib/staff'
import { GenerateCodesForm } from '@/components/admin/GenerateCodesForm'
import { Eyebrow } from '@/components/ui/Eyebrow'

export const dynamic = 'force-dynamic'

type Batch = { batch: string; total: number; redeemed: number; points: number }

export default async function CodesPage() {
  const staff = await getStaffUser()
  if (!isAtLeast(staff, 'manager')) {
    return (
      <p className="bg-eb-cream px-5 py-10 text-center text-body text-eb-grey">
        Réservé aux responsables.
      </p>
    )
  }

  const supabase = await createClient()
  const { data } = supabase
    ? await supabase.from('claim_codes').select('batch, status, points')
    : { data: [] }

  const rows = (data ?? []) as { batch: string; status: string; points: number }[]
  const batches = new Map<string, Batch>()
  for (const r of rows) {
    const b = batches.get(r.batch) ?? { batch: r.batch, total: 0, redeemed: 0, points: r.points }
    b.total += 1
    if (r.status === 'redeemed') b.redeemed += 1
    batches.set(r.batch, b)
  }

  return (
    <>
      <h1 className="text-display-l">Codes de sac</h1>
      <p className="mt-1 max-w-xl text-body-s text-eb-grey">
        Un sticker par sac Glovo : QR vers <span className="eb-price">/sac?c=CODE</span>{' '}
        et le code écrit en clair dessous. C’est ce qui convertit un client de
        la marketplace en client identifié.
      </p>

      <section className="mt-8 max-w-sm">
        <GenerateCodesForm />
      </section>

      <section className="mt-10 border-t border-eb-line pt-6">
        <h2 className="mb-4 text-display-m">Lots</h2>
        {batches.size === 0 ? (
          <p className="bg-eb-cream px-5 py-8 text-center text-body text-eb-grey">
            Aucun lot généré.
          </p>
        ) : (
          <ul className="flex flex-col">
            {[...batches.values()].map((b) => (
              <li
                key={b.batch}
                className="flex items-baseline justify-between gap-4 border-b border-eb-line py-3"
              >
                <div>
                  <p className="text-body-l font-semibold">{b.batch}</p>
                  <p className="text-body-s text-eb-grey">
                    {b.points} points par code
                  </p>
                </div>
                <div className="text-right">
                  <Eyebrow className="text-eb-grey">scannés</Eyebrow>
                  <p className="eb-price font-display text-display-m">
                    {b.redeemed}/{b.total}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  )
}
