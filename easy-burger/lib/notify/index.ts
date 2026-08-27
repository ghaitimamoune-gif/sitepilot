import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import { renderTemplate } from './templates'
import { LogAdapter } from './log-adapter'
import { SmsAdapter } from './sms-adapter'
import type { MessageAdapter } from './types'

export * from './types'
export { renderTemplate } from './templates'

/**
 * L'adaptateur actif.
 *
 * Le vrai fournisseur dès qu'il est configuré, le journal sinon : la file ne
 * doit jamais se boucher parce qu'un contrat n'est pas signé.
 */
export function getMessageAdapter(): MessageAdapter {
  return SmsAdapter.isConfigured() ? SmsAdapter : LogAdapter
}

type PendingRow = {
  id: string
  phone: string
  template: string
  payload: Record<string, unknown>
}

/**
 * Vide la file d'attente.
 *
 * Appelée par le job périodique. Chaque message est marqué avant l'envoi
 * suivant, de sorte qu'une interruption au milieu ne renvoie pas ce qui est
 * déjà parti.
 */
export async function flushMessages(limit = 100): Promise<{
  sent: number
  failed: number
  adapter: string
}> {
  const supabase = createServiceClient()
  const adapter = getMessageAdapter()

  if (!supabase) return { sent: 0, failed: 0, adapter: adapter.name }

  const { data } = await supabase
    .from('messages_log')
    .select('id, phone, template, payload')
    .eq('status', 'pending')
    .order('created_at')
    .limit(limit)

  const pending = (data ?? []) as PendingRow[]
  let sent = 0
  let failed = 0

  for (const row of pending) {
    const body = renderTemplate(row.template, row.payload)

    if (!body) {
      // Gabarit inconnu : on le sort de la file plutôt que de boucher la file.
      await supabase.rpc('mark_message', {
        p_id: row.id,
        p_status: 'skipped',
        p_error: `Gabarit inconnu : ${row.template}`,
      })
      continue
    }

    const result = await adapter.send({
      id: row.id,
      phone: row.phone,
      template: row.template,
      body,
    })

    await supabase.rpc('mark_message', {
      p_id: row.id,
      p_status: result.ok ? 'sent' : 'failed',
      p_error: result.ok ? null : result.error,
    })

    if (result.ok) sent += 1
    else failed += 1
  }

  return { sent, failed, adapter: adapter.name }
}
