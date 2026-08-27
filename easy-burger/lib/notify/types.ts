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
  body: string
}

export type SendResult = { ok: true; providerRef?: string } | { ok: false; error: string }

export interface MessageAdapter {
  readonly name: string
  isConfigured(): boolean
  send(message: OutgoingMessage): Promise<SendResult>
}
