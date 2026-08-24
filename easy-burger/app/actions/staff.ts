'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { parseMADToCents } from '@/lib/money'
import type { OrderStatus } from '@/types/db'

type ActionResult = { ok: true; message: string } | { ok: false; error: string }

const NO_DB = 'La base n’est pas branchée.'

/* --------------------------------------------------------------- connexion */

export async function signIn(_prev: unknown, formData: FormData): Promise<ActionResult> {
  const supabase = await createClient()
  if (!supabase) return { ok: false, error: NO_DB }

  const email = String(formData.get('email') ?? '').trim()
  const password = String(formData.get('password') ?? '')

  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) {
    // §4.4 : on dit ce qui s'est passé, sans détailler lequel des deux champs
    // est faux — ce serait offrir un oracle sur les comptes existants.
    return { ok: false, error: 'E-mail ou mot de passe incorrect.' }
  }

  redirect('/admin')
}

export async function signOut() {
  const supabase = await createClient()
  await supabase?.auth.signOut()
  redirect('/admin/login')
}

/* ----------------------------------------------------------- commandes */

export async function setOrderStatus(
  orderId: string,
  status: OrderStatus,
  reason?: string,
): Promise<ActionResult> {
  const supabase = await createClient()
  if (!supabase) return { ok: false, error: NO_DB }

  const { data, error } = await supabase.rpc('set_order_status', {
    p_order_id: orderId,
    p_status: status,
    p_reason: reason ?? null,
  })

  if (error) return { ok: false, error: error.message }

  const credited = (data as { points_credited?: number } | null)?.points_credited ?? 0
  revalidatePath('/admin')

  return {
    ok: true,
    message: credited > 0 ? `Statut mis à jour · ${credited} points crédités` : 'Statut mis à jour',
  }
}

/* ------------------------------------------- crédit au comptoir par ticket */

export type CreditTicketResult =
  | {
      ok: true
      phone: string
      pointsCredited: number
      newBalance: number
      customerCreated: boolean
      ticketRef: string
    }
  | { ok: false; error: string }

/**
 * §11.2 — Niveau 1, aucune dépendance à une API de caisse.
 *
 * Le caissier saisit numéro + montant + référence du ticket. Si le même
 * ticket a déjà été crédité, la base refuse : l'unicité est portée par un
 * index, pas par une vérification applicative qu'une saisie simultanée
 * pourrait contourner.
 */
export async function creditTicket(
  _prev: unknown,
  formData: FormData,
): Promise<CreditTicketResult> {
  const supabase = await createClient()
  if (!supabase) return { ok: false, error: NO_DB }

  const phone = String(formData.get('phone') ?? '').trim()
  const amountRaw = String(formData.get('amount') ?? '').trim()
  const ticketRef = String(formData.get('ticket_ref') ?? '').trim()

  const amountCents = parseMADToCents(amountRaw)
  if (amountCents === null) {
    return { ok: false, error: 'Le montant ne contient que des chiffres. Exemple : 74,50' }
  }

  const { data, error } = await supabase.rpc('credit_ticket_points', {
    p_phone: phone,
    p_amount_cents: amountCents,
    p_ticket_ref: ticketRef,
  })

  if (error) return { ok: false, error: error.message }

  const r = data as {
    phone: string
    points_credited: number
    new_balance: number
    customer_created: boolean
    ticket_ref: string
  }

  revalidatePath('/staff')

  return {
    ok: true,
    phone: r.phone,
    pointsCredited: r.points_credited,
    newBalance: r.new_balance,
    customerCreated: r.customer_created,
    ticketRef: r.ticket_ref,
  }
}

/* ---------------------------------------- ajustement manuel (superadmin) */

/**
 * §10 — le filet de sécurité qui ne dépend d'aucun système externe.
 * Le contrôle du rôle est fait dans la fonction SQL, pas ici : un appel
 * direct à l'API par un caissier serait refusé de la même manière.
 */
export async function adjustPoints(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult> {
  const supabase = await createClient()
  if (!supabase) return { ok: false, error: NO_DB }

  const customerId = String(formData.get('customer_id') ?? '')
  const raw = String(formData.get('points') ?? '').trim()
  const reason = String(formData.get('reason') ?? '').trim()

  if (!/^-?\d+$/.test(raw)) {
    return { ok: false, error: 'Indique un nombre entier de points, négatif pour retirer.' }
  }
  if (reason === '') {
    return { ok: false, error: 'Le motif est obligatoire.' }
  }

  const { data, error } = await supabase.rpc('adjust_points', {
    p_customer_id: customerId,
    p_points: Number(raw),
    p_reason: reason,
  })

  if (error) return { ok: false, error: error.message }

  revalidatePath(`/admin/clients/${customerId}`)

  const balance = (data as { new_balance: number }).new_balance
  return { ok: true, message: `Nouveau solde : ${balance} points` }
}
