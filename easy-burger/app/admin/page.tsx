import { createClient } from '@/lib/supabase/server'
import { getStaffUser } from '@/lib/staff'
import type { OrderRow } from '@/types/db'
import { OrderQueue } from '@/components/admin/OrderQueue'
import { Eyebrow } from '@/components/ui/Eyebrow'
import { formatMAD } from '@/lib/money'

export const dynamic = 'force-dynamic'

export default async function AdminOrdersPage() {
  const staff = await getStaffUser()
  const supabase = await createClient()
  if (!supabase) return null

  if (!staff) return <NotStaff />

  // La file du jour (§10) : depuis minuit, les commandes non terminées
  // d'abord, puis les plus récentes.
  const since = new Date()
  since.setHours(0, 0, 0, 0)

  const { data } = await supabase
    .from('orders')
    .select(
      `id, order_number, status, mode, channel, total_cents, subtotal_cents,
       delivery_fee_cents, contact_name, contact_phone, address_snapshot,
       note, placed_at,
       order_items ( name_snapshot, qty, line_total_cents )`,
    )
    .gte('placed_at', since.toISOString())
    .order('placed_at', { ascending: false })

  const orders = (data ?? []) as unknown as OrderRow[]

  const open = orders.filter((o) => o.status !== 'completed' && o.status !== 'cancelled')
  const revenue = orders
    .filter((o) => o.status === 'completed')
    .reduce((n, o) => n + o.total_cents, 0)

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-display-l">Commandes du jour</h1>
        <div className="flex gap-6">
          <Stat label="en cours" value={String(open.length)} />
          <Stat label="terminées" value={String(orders.length - open.length)} />
          <Stat label="encaissé" value={formatMAD(revenue)} />
        </div>
      </div>

      <OrderQueue orders={orders} />
    </>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <Eyebrow className="text-eb-grey">{label}</Eyebrow>
      <p className="eb-price font-display text-display-m">{value}</p>
    </div>
  )
}

function NotStaff() {
  return (
    <div className="bg-eb-cream px-5 py-10 text-center">
      <Eyebrow className="text-eb-grey">accès refusé</Eyebrow>
      <p className="mx-auto mt-3 max-w-md text-body text-eb-grey">
        Ce compte est connecté mais ne figure pas dans le personnel. Un
        superadmin doit l’ajouter à la table{' '}
        <span className="eb-price">staff_users</span>.
      </p>
    </div>
  )
}
