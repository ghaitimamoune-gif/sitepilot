import {
  ProviderNotConfiguredError,
  type PaymentProvider,
  type PaymentIntent,
  type PaymentVerification,
  type RefundResult,
} from './types'

/**
 * §12 — Payzone, « activation rapide, sert de rampe de lancement ».
 *
 * L'adaptateur est en place, la conversation avec le prestataire ne l'est
 * pas encore. Ce qui manque est nommé plutôt que deviné : le jour où le
 * contrat arrive, il n'y a que les trois appels HTTP à écrire, et rien à
 * changer ailleurs dans l'application.
 *
 * À demander à Payzone :
 *   — l'URL de l'API et le format d'authentification ;
 *   — comment signer et vérifier le callback (§12 : le statut se confirme
 *     côté serveur, une signature invérifiable ne vaut rien) ;
 *   — s'ils renvoient un jeton de carte réutilisable.
 */
const ENV = {
  merchantId: process.env.PAYZONE_MERCHANT_ID,
  apiKey: process.env.PAYZONE_API_KEY,
  webhookSecret: process.env.PAYZONE_WEBHOOK_SECRET,
}

function missing(): string[] {
  return Object.entries(ENV)
    .filter(([, v]) => !v)
    .map(([k]) => `PAYZONE_${k.replace(/[A-Z]/g, (c) => '_' + c).toUpperCase()}`)
}

export const PayzoneProvider: PaymentProvider = {
  name: 'payzone',

  isConfigured() {
    return missing().length === 0
  },

  async createPayment(): Promise<PaymentIntent> {
    throw new ProviderNotConfiguredError('Payzone', missing())
  },

  async verifyPayment(): Promise<PaymentVerification> {
    throw new ProviderNotConfiguredError('Payzone', missing())
  },

  async refund(): Promise<RefundResult> {
    return { ok: false, error: new ProviderNotConfiguredError('Payzone', missing()).message }
  },
}
