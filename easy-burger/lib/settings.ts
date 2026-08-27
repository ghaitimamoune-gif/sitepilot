import 'server-only'
import { createClient } from './supabase/server'
import type { SettingKey } from '@/types'

/**
 * Règle absolue du brief (§0) : aucune règle métier en dur dans le code.
 * Tout montant, seuil, ratio ou délai vit dans la table `settings` et se
 * modifie depuis le back-office.
 *
 * Les valeurs ci-dessous ne sont PAS la règle métier : ce sont les valeurs
 * d'amorçage, identiques à celles de la migration 000_settings.sql. Elles
 * servent de filet quand la base n'est pas encore branchée (Phase 0) ou
 * qu'une clé a été supprimée par erreur.
 */
export const SETTING_DEFAULTS: Record<SettingKey, unknown> = {
  points_per_mad: 1,
  redemption_rate: 10, // 10 points = 1 MAD
  points_expiry_months: 12,
  welcome_reward_enabled: true,
  welcome_min_order_cents: 7000,
  birthday_reward_product_id: null,
  delivery_fee_cents: 0,
  free_delivery_threshold_cents: 0,
  min_order_cents: 0,
  opening_hours: null,
  is_accepting_orders: true,
  cashier_daily_points_cap: 20000,
  redemption_code_ttl_minutes: 15,
  ticket_claim_days: 7,
  payment_provider: 'cash',
}

type SettingsMap = Record<string, unknown>

// Cache mémoire court : le menu est rendu côté serveur à chaque visite, on
// ne veut pas une requête `settings` par rendu. 60 s suffisent — un
// changement de réglage se voit dans la minute.
const TTL_MS = 60_000
let cache: { at: number; value: SettingsMap } | null = null

export async function getSettings(): Promise<SettingsMap> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.value

  const supabase = await createClient()
  if (!supabase) return { ...SETTING_DEFAULTS }

  const { data, error } = await supabase.from('settings').select('key, value')
  if (error || !data) return { ...SETTING_DEFAULTS }

  const value: SettingsMap = { ...SETTING_DEFAULTS }
  for (const row of data) value[row.key] = row.value

  cache = { at: Date.now(), value }
  return value
}

export async function getSetting<T = unknown>(key: SettingKey): Promise<T> {
  const all = await getSettings()
  return all[key] as T
}

/** À appeler après une écriture depuis le back-office. */
export function invalidateSettingsCache() {
  cache = null
}
