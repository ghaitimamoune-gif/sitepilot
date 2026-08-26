'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

const NO_DB = 'La base n’est pas branchée.'

export type RedeemResult =
  | { ok: true; id: string; code: string; title: string; expiresAt: string }
  | { ok: false; error: string }

/**
 * §6.5 — l'échange débite les points et émet un code à 6 chiffres valable
 * 15 minutes, à usage unique. Tout se passe côté serveur : le navigateur
 * n'envoie qu'un identifiant de récompense.
 */
export async function redeemReward(slug: string): Promise<RedeemResult> {
  const supabase = await createClient()
  if (!supabase) return { ok: false, error: NO_DB }

  const { data, error } = await supabase.rpc('redeem_reward', { p_reward_slug: slug })
  if (error) return { ok: false, error: error.message }

  const r = data as { id: string; code: string; title: string; expires_at: string }
  revalidatePath('/fidelite')

  return { ok: true, id: r.id, code: r.code, title: r.title, expiresAt: r.expires_at }
}

export type ConsumeResult =
  | { ok: true; title: string; phone: string }
  | { ok: false; error: string }

/** Validation du code au comptoir. Réservée au personnel. */
export async function consumeRewardCode(
  _prev: unknown,
  formData: FormData,
): Promise<ConsumeResult> {
  const supabase = await createClient()
  if (!supabase) return { ok: false, error: NO_DB }

  const code = String(formData.get('code') ?? '').replace(/\D/g, '')
  if (code.length !== 6) {
    return { ok: false, error: 'Le code fait 6 chiffres.' }
  }

  const { data, error } = await supabase.rpc('consume_reward_code', { p_code: code })
  if (error) return { ok: false, error: error.message }

  const r = data as { title: string; phone: string }
  revalidatePath('/staff')
  return { ok: true, title: r.title, phone: r.phone }
}
