/** Types des lignes lues depuis Supabase. Miroir des migrations. */

export type OptionType = 'single' | 'multi'

export type OrderStatus =
  | 'received'
  | 'preparing'
  | 'ready'
  | 'delivering'
  | 'completed'
  | 'cancelled'

export type OrderMode = 'delivery' | 'pickup'
export type OrderChannel = 'app' | 'counter' | 'glovo'
export type StaffRole = 'cashier' | 'manager' | 'admin' | 'superadmin'

export type OptionValue = {
  id: string
  name: string
  price_delta_cents: number
  is_available: boolean
  sort_order: number
}

export type ProductOption = {
  id: string
  name: string
  type: OptionType
  is_required: boolean
  sort_order: number
  values: OptionValue[]
}

export type Product = {
  id: string
  slug: string
  name: string
  description: string | null
  price_cents: number
  image_url: string | null
  sort_order: number
  is_available: boolean
  is_featured: boolean
  options?: ProductOption[]
}

export type Category = {
  id: string
  slug: string
  name: string
  sort_order: number
  products: Product[]
}

export type OrderRow = {
  id: string
  order_number: string | null
  public_token?: string
  status: OrderStatus
  mode: OrderMode
  channel: OrderChannel
  total_cents: number
  subtotal_cents: number
  delivery_fee_cents: number
  contact_name: string | null
  contact_phone: string | null
  address_snapshot: string | null
  note: string | null
  placed_at: string
  order_items: { name_snapshot: string; qty: number; line_total_cents: number }[]
}

export type CustomerRow = {
  id: string
  phone: string
  first_name: string | null
  last_name: string | null
  email?: string | null
  birthdate?: string | null
  marketing_consent?: boolean
  points_balance: number
  lifetime_spend: number
  orders_count: number
  last_order_at: string | null
  created_at: string
}

export type LoyaltyRow = {
  id: string
  type: 'earn' | 'redeem' | 'bonus' | 'adjust' | 'expire'
  source: string
  source_ref: string | null
  points: number
  amount_cents: number | null
  note: string | null
  created_at: string
  expires_at?: string | null
  /**
   * Jointure facultative vers la commande d'origine.
   * PostgREST renvoie un objet pour une relation « plusieurs vers un », mais
   * le typage par défaut du client la décrit comme un tableau : on accepte
   * les deux et on normalise à la lecture.
   */
  orders?: { order_number: string | null } | { order_number: string | null }[] | null
}

/** Retour de public.get_order_by_token(). */
export type TrackedOrder = {
  order_number: string
  status: OrderStatus
  mode: OrderMode
  placed_at: string
  subtotal_cents: number
  delivery_fee_cents: number
  total_cents: number
  contact_name: string | null
  address_snapshot: string | null
  note: string | null
  /** §8 — le prénom est demandé après la première commande, pas avant. */
  needs_name: boolean
  items: { name: string; qty: number; line_total_cents: number; options: string[] }[]
}
