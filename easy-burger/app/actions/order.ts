'use server'

import { createClient } from '@/lib/supabase/server'

export type PlaceOrderInput = {
  mode: 'delivery' | 'pickup'
  phone: string
  name: string
  address?: string
  note?: string
  items: { product_id: string; qty: number; options: string[] }[]
}

export type PlaceOrderResult =
  | { ok: true; token: string; orderNumber: string; totalCents: number }
  | { ok: false; error: string }

/**
 * Passe la commande.
 *
 * Cette action ne calcule aucun montant : elle transmet des identifiants et
 * des quantités à public.place_order(), qui relit chaque prix en base. C'est
 * volontaire — le seul endroit où un total est calculé est le serveur SQL.
 */
export async function placeOrder(input: PlaceOrderInput): Promise<PlaceOrderResult> {
  const supabase = await createClient()
  if (!supabase) {
    return { ok: false, error: 'La commande en ligne n’est pas encore activée.' }
  }

  if (input.items.length === 0) {
    return { ok: false, error: 'Ton panier est vide.' }
  }

  const { data, error } = await supabase.rpc('place_order', {
    payload: {
      mode: input.mode,
      phone: input.phone,
      name: input.name,
      address: input.address ?? null,
      note: input.note ?? null,
      items: input.items,
    },
  })

  if (error) {
    // Les messages viennent des `raise exception` des migrations : ils sont
    // déjà rédigés pour un client (§4.4 — on dit ce qui s'est passé et ce
    // qu'il faut faire).
    return { ok: false, error: error.message || 'La commande n’a pas pu être enregistrée.' }
  }

  const result = data as {
    id: string
    order_number: string
    public_token: string
    total_cents: number
  }

  return {
    ok: true,
    token: result.public_token,
    orderNumber: result.order_number,
    totalCents: result.total_cents,
  }
}

/**
 * §8 — « Prénom demandé après la première commande réussie, pas avant. »
 * Appelé depuis l'écran de suivi. Le jeton de la commande fait l'autorisation.
 */
export async function nameCustomer(
  token: string,
  name: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient()
  if (!supabase) return { ok: false, error: 'La base n’est pas branchée.' }

  const { error } = await supabase.rpc('name_customer_by_order_token', {
    p_token: token,
    p_name: name,
  })

  if (error) return { ok: false, error: error.message }
  return { ok: true }
}
