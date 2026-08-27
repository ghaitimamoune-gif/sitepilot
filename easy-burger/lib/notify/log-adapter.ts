import type { MessageAdapter, OutgoingMessage, SendResult } from './types'

/**
 * L'adaptateur par défaut, tant qu'aucun fournisseur SMS n'est choisi (§16 :
 * le fournisseur et son coût unitaire vers le Maroc restent à trancher, et
 * cette donnée conditionne toute la stratégie d'OTP).
 *
 * Il n'envoie rien mais journalise tout : la file se vide, le contenu exact
 * des messages est vérifiable, et le jour où un vrai adaptateur arrive, rien
 * d'autre ne change.
 */
export const LogAdapter: MessageAdapter = {
  name: 'log',

  isConfigured() {
    return true
  },

  async send(message: OutgoingMessage): Promise<SendResult> {
    console.info(`[message:${message.template}] → ${message.phone} : ${message.body}`)
    return { ok: true, providerRef: `log-${message.id}` }
  },
}
