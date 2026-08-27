/**
 * §12 — l'interface de paiement.
 *
 * Aucun nom de prestataire n'apparaît dans le code métier : le checkout, la
 * file de commandes et le tableau de bord ne connaissent que ces trois
 * méthodes. Changer de prestataire, ou en ajouter un, ne touche que le
 * dossier `lib/payments`.
 */

export type PaymentIntent = {
  /** Identifiant interne, transmis au prestataire pour le retrouver au callback. */
  paymentId: string
  amountCents: number
  /** URL vers laquelle envoyer le client, quand le prestataire en impose une. */
  redirectUrl?: string
  /** Vrai quand rien n'est à faire côté client : espèces, par exemple. */
  settledImmediately: boolean
}

export type PaymentStatus =
  | 'created'
  | 'authorized'
  | 'paid'
  | 'failed'
  | 'refunded'
  | 'expired'

export type PaymentVerification = {
  status: PaymentStatus
  providerRef?: string
  /** Jeton de carte enregistrée. JAMAIS un numéro de carte. */
  cardToken?: string
  cardLast4?: string
  cardBrand?: string
  failureReason?: string
}

export type RefundResult = { ok: true } | { ok: false; error: string }

export interface PaymentProvider {
  /** Nom court, utilisé pour le routage du callback et le support. */
  readonly name: string

  /** Vrai quand le prestataire est configuré et utilisable. */
  isConfigured(): boolean

  createPayment(input: {
    orderId: string
    amountCents: number
    customerPhone: string
    returnUrl: string
  }): Promise<PaymentIntent>

  /**
   * Lit l'état réel du paiement chez le prestataire.
   *
   * §12 : le statut est confirmé par callback serveur, jamais par le retour
   * navigateur. Cette méthode reçoit la charge utile du callback, la vérifie
   * (signature comprise) et dit ce qui s'est vraiment passé.
   */
  verifyPayment(payload: unknown): Promise<PaymentVerification>

  refund(input: { paymentId: string; amountCents: number }): Promise<RefundResult>
}

/** Levée par un adaptateur dont le contrat n'est pas encore signé. */
export class ProviderNotConfiguredError extends Error {
  constructor(provider: string, missing: string[]) {
    super(
      `Le paiement par ${provider} n'est pas encore activé. ` +
        `Manque : ${missing.join(', ')}.`,
    )
    this.name = 'ProviderNotConfiguredError'
  }
}
