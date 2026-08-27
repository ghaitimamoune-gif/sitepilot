import { NextResponse, type NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { flushMessages } from '@/lib/notify'

export const dynamic = 'force-dynamic'

/**
 * Les travaux périodiques, en un seul point d'entrée.
 *
 * À appeler une fois par jour par un planificateur (Netlify Scheduled
 * Functions, cron-job.org, ou n'importe quoi qui sache faire un POST), avec
 * l'en-tête `Authorization: Bearer <CRON_SECRET>`.
 *
 * Chaque tâche est idempotente : la rejouer ne double rien. C'est ce qui
 * permet de la relancer à la main sans réfléchir quand un jour a sauté.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'CRON_SECRET absent' }, { status: 503 })
  }

  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()
  if (!supabase) {
    return NextResponse.json({ error: 'service unavailable' }, { status: 503 })
  }

  const results: Record<string, unknown> = {}

  // Codes de récompense échus : les points reviennent au client.
  const { data: codes } = await supabase.rpc('expire_reward_codes')
  results.reward_codes_expired = codes ?? 0

  // Lots de points échus, en FIFO.
  const { data: points } = await supabase.rpc('expire_points')
  results.point_lots_expired = points ?? 0

  // Cadeaux d'anniversaire, 3 jours avant la date.
  const { data: birthdays } = await supabase.rpc('grant_birthday_rewards')
  results.birthday_gifts = birthdays ?? 0

  // Réclamations de tickets en attente.
  const { data: reconciled } = await supabase.rpc('reconcile_pos_claims')
  results.pos_claims = reconciled ?? {}

  // Alerte 30 jours avant expiration.
  const { data: warnings } = await supabase.rpc('enqueue_expiry_warnings', { p_days: 30 })
  results.expiry_warnings = warnings ?? 0

  // Et on vide la file de messages.
  results.messages = await flushMessages(200)

  return NextResponse.json({ ran_at: new Date().toISOString(), ...results })
}
