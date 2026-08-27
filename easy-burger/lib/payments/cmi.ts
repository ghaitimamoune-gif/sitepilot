import {
  ProviderNotConfiguredError,
  type PaymentProvider,
  type PaymentIntent,
  type PaymentVerification,
  type RefundResult,
} from './types'

/**
 * §12 — le CMI, « indispensable à terme pour les cartes marocaines et pour
 * la crédibilité de la page de paiement ».
 *
 * Trois points à trancher au moment de la souscription du contrat, et le
 * troisième décide de l'expérience :
 *
 *   — le 3D Secure est-il exigé à CHAQUE transaction, ou le paiement sur
 *     carte enregistrée est-il autorisé ? C'est cette réponse, et elle
 *     seule, qui dit si le paiement en un tap est possible (§16).
 *   — l'enregistrement de carte pour achats répétitifs doit être demandé
 *     explicitement à la souscription : il ne s'active pas après coup.
 *   — le format exact du hash de callback, qui change selon les versions de
 *     la passerelle.
 *
 * Quoi qu'il en sorte : on stockera le jeton renvoyé par le CMI, jamais un
 * numéro de carte. Un trigger en base refuse d'ailleurs tout jeton qui
 * ressemble à un PAN.
 */
const ENV = {
  clientId: process.env.CMI_CLIENT_ID,
  storeKey: process.env.CMI_STORE_KEY,
  gatewayUrl: process.env.CMI_GATEWAY_URL,
}

function missing(): string[] {
  return Object.entries(ENV)
    .filter(([, v]) => !v)
    .map(([k]) => `CMI_${k.replace(/[A-Z]/g, (c) => '_' + c).toUpperCase()}`)
}

export const CmiProvider: PaymentProvider = {
  name: 'cmi',

  isConfigured() {
    return missing().length === 0
  },

  async createPayment(): Promise<PaymentIntent> {
    throw new ProviderNotConfiguredError('CMI', missing())
  },

  async verifyPayment(): Promise<PaymentVerification> {
    throw new ProviderNotConfiguredError('CMI', missing())
  },

  async refund(): Promise<RefundResult> {
    return { ok: false, error: new ProviderNotConfiguredError('CMI', missing()).message }
  },
}
