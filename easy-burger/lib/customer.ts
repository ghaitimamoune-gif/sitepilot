import { createClient } from './supabase/server'
import type { CustomerRow, LoyaltyRow, OrderRow } from '@/types/db'

/**
 * Le client connecté, ou `null`.
 *
 * L'identité tient au numéro de téléphone vérifié par OTP ; la fiche est
 * rattachée au compte Auth par `link_current_customer()` au moment de la
 * connexion.
 */
export async function getCurrentCustomer(): Promise<CustomerRow | null> {
  const supabase = await createClient()
  if (!supabase) return null

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('customers')
    .select(
      'id, phone, first_name, last_name, email, birthdate, points_balance, lifetime_spend, orders_count, last_order_at, marketing_consent, created_at',
    )
    .eq('auth_user_id', user.id)
    .maybeSingle()

  return (data as CustomerRow | null) ?? null
}

export type Address = {
  id: string
  label: string | null
  street: string
  details: string | null
  is_default: boolean
}

export async function getMyAddresses(): Promise<Address[]> {
  const supabase = await createClient()
  if (!supabase) return []

  const { data } = await supabase
    .from('addresses')
    .select('id, label, street, details, is_default')
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: false })

  return (data ?? []) as Address[]
}

export async function getMyLedger(limit = 50): Promise<LoyaltyRow[]> {
  const supabase = await createClient()
  if (!supabase) return []

  const { data } = await supabase
    .from('loyalty_transactions')
    .select(
      'id, type, source, source_ref, points, amount_cents, note, created_at, expires_at, orders ( order_number )',
    )
    .order('created_at', { ascending: false })
    .limit(limit)

  return (data ?? []) as unknown as LoyaltyRow[]
}

export async function getMyOrders(limit = 20): Promise<OrderRow[]> {
  const supabase = await createClient()
  if (!supabase) return []

  const { data } = await supabase
    .from('orders')
    .select(
      `id, order_number, public_token, status, mode, channel, total_cents,
       subtotal_cents, delivery_fee_cents, contact_name, contact_phone,
       address_snapshot, note, placed_at,
       order_items ( name_snapshot, qty, line_total_cents )`,
    )
    .order('placed_at', { ascending: false })
    .limit(limit)

  return (data ?? []) as unknown as OrderRow[]
}

/**
 * Le prochain lot de points à expirer.
 *
 * §6.3 : les points expirent 12 mois après leur acquisition, consommation
 * en FIFO. On montre la date la plus proche pour que le client sache
 * combien de temps il lui reste.
 */
export function nextExpiry(ledger: LoyaltyRow[]): { at: string; points: number } | null {
  const upcoming = ledger
    .filter((t) => t.points > 0 && t.expires_at)
    .sort((a, b) => (a.expires_at! < b.expires_at! ? -1 : 1))

  const first = upcoming[0]
  if (!first?.expires_at) return null

  const sameDay = upcoming.filter(
    (t) => t.expires_at!.slice(0, 10) === first.expires_at!.slice(0, 10),
  )

  return {
    at: first.expires_at,
    points: sameDay.reduce((n, t) => n + t.points, 0),
  }
}
