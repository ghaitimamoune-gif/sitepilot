import { createClient } from './supabase/server'

export type Reward = {
  id: string
  slug: string
  title: string
  description: string | null
  image_url: string | null
  points_cost: number
}

export type Redemption = {
  id: string
  code: string
  status: 'issued' | 'used' | 'expired' | 'cancelled'
  points_spent: number
  expires_at: string
  issued_at: string
  rewards: { title: string } | { title: string }[] | null
}

/** La boutique (§6.2). Les cadeaux ne s'y trouvent pas : ils ne s'échangent pas. */
export async function getRewards(): Promise<Reward[]> {
  const supabase = await createClient()
  if (!supabase) return []

  const { data } = await supabase
    .from('rewards')
    .select('id, slug, title, description, image_url, points_cost')
    .eq('is_active', true)
    .order('sort_order')

  return (data ?? []) as Reward[]
}

/** Les codes en cours du client : échanges et cadeaux. */
export async function getActiveRedemptions(): Promise<Redemption[]> {
  const supabase = await createClient()
  if (!supabase) return []

  const { data } = await supabase
    .from('reward_redemptions')
    .select('id, code, status, points_spent, expires_at, issued_at, rewards ( title )')
    .eq('status', 'issued')
    .gt('expires_at', new Date().toISOString())
    .order('expires_at')

  return (data ?? []) as unknown as Redemption[]
}

export async function getRedemption(id: string): Promise<Redemption | null> {
  const supabase = await createClient()
  if (!supabase) return null

  const { data } = await supabase
    .from('reward_redemptions')
    .select('id, code, status, points_spent, expires_at, issued_at, rewards ( title )')
    .eq('id', id)
    .maybeSingle()

  return (data as unknown as Redemption | null) ?? null
}

/** PostgREST peut renvoyer la relation en objet ou en tableau selon le cas. */
export function rewardTitle(r: Redemption): string {
  const rel = r.rewards
  if (!rel) return 'Récompense'
  return Array.isArray(rel) ? (rel[0]?.title ?? 'Récompense') : rel.title
}
