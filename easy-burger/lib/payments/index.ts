import 'server-only'
import { getSetting } from '@/lib/settings'
import { CashProvider } from './cash'
import { PayzoneProvider } from './payzone'
import { CmiProvider } from './cmi'
import type { PaymentProvider } from './types'

export * from './types'

const PROVIDERS: Record<string, PaymentProvider> = {
  cash: CashProvider,
  payzone: PayzoneProvider,
  cmi: CmiProvider,
}

/**
 * Le prestataire actif, choisi par le réglage `payment_provider` (§0 : aucune
 * règle métier en dur).
 *
 * Repli sur les espèces si le prestataire configuré n'est pas utilisable :
 * mieux vaut encaisser à la livraison que refuser la commande.
 */
export async function getPaymentProvider(): Promise<PaymentProvider> {
  const name = (await getSetting<string>('payment_provider')) ?? 'cash'
  const provider = PROVIDERS[name]

  if (!provider || !provider.isConfigured()) return CashProvider
  return provider
}

/** Routage du callback : le prestataire vient de l'URL, pas du corps. */
export function getProviderByName(name: string): PaymentProvider | null {
  return PROVIDERS[name] ?? null
}
