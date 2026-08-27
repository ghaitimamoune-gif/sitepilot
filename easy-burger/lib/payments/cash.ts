import type { PaymentProvider, PaymentIntent, PaymentVerification, RefundResult } from './types'

/**
 * §12 — « À faire en premier : ce sera une part majoritaire des commandes au
 * démarrage. »
 *
 * L'espèce n'a ni redirection ni callback : le paiement se constate quand la
 * commande passe à « terminée ». C'est `set_order_status` qui le fait, ce
 * qui garde une seule source de vérité.
 */
export const CashProvider: PaymentProvider = {
  name: 'cash',

  isConfigured() {
    return true
  },

  async createPayment({ amountCents }): Promise<PaymentIntent> {
    return {
      paymentId: '',
      amountCents,
      settledImmediately: true,
    }
  },

  async verifyPayment(): Promise<PaymentVerification> {
    // Rien à vérifier : personne n'a payé en ligne.
    return { status: 'created' }
  },

  async refund(): Promise<RefundResult> {
    return {
      ok: false,
      error: 'Un paiement en espèces se rembourse en caisse, pas depuis l’application.',
    }
  },
}
