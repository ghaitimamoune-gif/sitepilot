'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { parseMADToCents } from '@/lib/money'
import type { SettingKey } from '@/types'

const NO_DB = 'La base n’est pas branchée.'
export type AdminResult = { ok: true; message: string } | { ok: false; error: string }

/* ------------------------------------------------------------------- menu */

/** §10 — rupture de stock en un clic. */
export async function toggleProduct(id: string, available: boolean): Promise<AdminResult> {
  const supabase = await createClient()
  if (!supabase) return { ok: false, error: NO_DB }

  const { error } = await supabase
    .from('products')
    .update({ is_available: available })
    .eq('id', id)

  if (error) return { ok: false, error: error.message }
  revalidatePath('/admin/menu')
  revalidatePath('/')
  return { ok: true, message: available ? 'Remis en vente' : 'Marqué épuisé' }
}

export async function updateProduct(
  _prev: unknown,
  formData: FormData,
): Promise<AdminResult> {
  const supabase = await createClient()
  if (!supabase) return { ok: false, error: NO_DB }

  const id = String(formData.get('id') ?? '')
  const priceCents = parseMADToCents(String(formData.get('price') ?? ''))
  if (priceCents === null) {
    return { ok: false, error: 'Le prix ne contient que des chiffres. Exemple : 60 ou 74,50' }
  }

  const { error } = await supabase
    .from('products')
    .update({
      name: String(formData.get('name') ?? '').trim(),
      description: String(formData.get('description') ?? '').trim() || null,
      price_cents: priceCents,
      image_url: String(formData.get('image_url') ?? '').trim() || null,
    })
    .eq('id', id)

  if (error) return { ok: false, error: error.message }
  revalidatePath('/admin/menu')
  revalidatePath('/')
  return { ok: true, message: 'Produit enregistré' }
}

/* --------------------------------------------------------------- réglages */

/**
 * §0 — tout ce qui est un montant, un seuil, un ratio ou un délai vit dans
 * `settings` et se modifie ici. Les valeurs sont stockées en JSON : on
 * respecte le type d'origine plutôt que de tout écraser en chaîne.
 */
export async function updateSettings(
  _prev: unknown,
  formData: FormData,
): Promise<AdminResult> {
  const supabase = await createClient()
  if (!supabase) return { ok: false, error: NO_DB }

  const updates: { key: string; value: unknown }[] = []

  for (const [rawKey, rawValue] of formData.entries()) {
    if (!rawKey.startsWith('s.')) continue
    const key = rawKey.slice(2)
    const kind = String(formData.get(`t.${key}`) ?? 'string')
    const text = String(rawValue).trim()

    let value: unknown
    if (kind === 'boolean') value = text === 'on' || text === 'true'
    else if (kind === 'number') {
      if (!/^-?\d+$/.test(text)) {
        return { ok: false, error: `« ${key} » attend un nombre entier.` }
      }
      value = Number(text)
    } else if (kind === 'money') {
      const cents = parseMADToCents(text)
      if (cents === null) return { ok: false, error: `« ${key} » attend un montant.` }
      value = cents
    } else value = text || null

    updates.push({ key, value })
  }

  // Une case décochée n'apparaît pas dans le formulaire : on remet à false
  // les booléens déclarés mais absents.
  for (const [rawKey] of formData.entries()) {
    if (!rawKey.startsWith('t.')) continue
    const key = rawKey.slice(2)
    if (String(formData.get(rawKey)) !== 'boolean') continue
    if (!updates.some((u) => u.key === key)) updates.push({ key, value: false })
  }

  for (const u of updates) {
    const { error } = await supabase
      .from('settings')
      .update({ value: u.value })
      .eq('key', u.key)
    if (error) return { ok: false, error: error.message }
  }

  revalidatePath('/admin/reglages')
  revalidatePath('/', 'layout')
  return { ok: true, message: `${updates.length} réglages enregistrés` }
}

/* ------------------------------------------------------------ récompenses */

export async function updateReward(
  _prev: unknown,
  formData: FormData,
): Promise<AdminResult> {
  const supabase = await createClient()
  if (!supabase) return { ok: false, error: NO_DB }

  const points = Number(formData.get('points_cost') ?? 0)
  if (!Number.isInteger(points) || points < 0) {
    return { ok: false, error: 'Le coût en points est un entier positif.' }
  }

  const { error } = await supabase
    .from('rewards')
    .update({
      title: String(formData.get('title') ?? '').trim(),
      points_cost: points,
      is_active: formData.get('is_active') === 'on',
    })
    .eq('id', String(formData.get('id') ?? ''))

  if (error) return { ok: false, error: error.message }
  revalidatePath('/admin/fidelite')
  revalidatePath('/fidelite')
  return { ok: true, message: 'Récompense enregistrée' }
}

/* ----------------------------------------------------------------- équipe */

export async function setStaffRole(id: string, role: string): Promise<AdminResult> {
  const supabase = await createClient()
  if (!supabase) return { ok: false, error: NO_DB }

  const { error } = await supabase.from('staff_users').update({ role }).eq('id', id)
  if (error) return { ok: false, error: error.message }

  revalidatePath('/admin/equipe')
  return { ok: true, message: 'Rôle mis à jour' }
}

export async function setStaffActive(id: string, active: boolean): Promise<AdminResult> {
  const supabase = await createClient()
  if (!supabase) return { ok: false, error: NO_DB }

  const { error } = await supabase
    .from('staff_users')
    .update({ is_active: active })
    .eq('id', id)
  if (error) return { ok: false, error: error.message }

  revalidatePath('/admin/equipe')
  return { ok: true, message: active ? 'Compte réactivé' : 'Compte désactivé' }
}

export type SettingRow = { key: SettingKey; value: unknown; label: string }
