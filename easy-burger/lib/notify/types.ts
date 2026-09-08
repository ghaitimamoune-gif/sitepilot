/**
 * §13 — l'abstraction d'envoi.
 *
 * Le code appelant ne connaît que `send`. Passer du SMS à WhatsApp Business
 * plus tard ne touchera que ce dossier.
 */
export type OutgoingMessage = {
  id: string
  phone: string
  template: string
  /** Texte rendu. Utilisé tel quel par le SMS ; ignoré par WhatsApp. */
  body: string
  /**
   * Données brutes du message. WhatsApp n'envoie pas de texte libre hors
   * fenêtre de 24 h : il envoie un nom de gabarit et ses variables.
   */
  payload: Record<string, unknown>
}

export type SendResult = { ok: true; providerRef?: string } | { ok: false; error: string }

export interface MessageAdapter {
  readonly name: string
  isConfigured(): boolean
  send(message: OutgoingMessage): Promise<SendResult>
}
