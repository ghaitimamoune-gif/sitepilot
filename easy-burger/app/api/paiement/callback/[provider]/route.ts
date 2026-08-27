import { NextResponse, type NextRequest } from 'next/server'
import { getProviderByName } from '@/lib/payments'
import { createServiceClient } from '@/lib/supabase/service'

/**
 * §12 — « Le statut de paiement est confirmé par callback serveur, jamais par
 * le retour navigateur du client. »
 *
 * Cette route est le seul endroit où un paiement devient vrai. Elle ne fait
 * confiance à rien de ce qu'elle reçoit : c'est l'adaptateur du prestataire
 * qui vérifie la signature et dit ce qui s'est passé, et c'est la base qui
 * applique le changement de façon idempotente — les prestataires réessaient,
 * le même callback arrive plusieurs fois.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider: name } = await params
  const provider = getProviderByName(name)

  if (!provider) {
    return NextResponse.json({ error: 'unknown provider' }, { status: 404 })
  }

  const contentType = request.headers.get('content-type') ?? ''
  const payload = contentType.includes('application/json')
    ? await request.json()
    : Object.fromEntries(await request.formData())

  let verification
  try {
    verification = await provider.verifyPayment({
      body: payload,
      headers: Object.fromEntries(request.headers),
    })
  } catch (err) {
    // Signature invalide, prestataire non configuré, charge utile inattendue :
    // on refuse sans rien changer. Un paiement non confirmé vaut mieux qu'un
    // paiement confirmé à tort.
    console.error(`[paiement:${name}] vérification refusée`, err)
    return NextResponse.json({ error: 'verification failed' }, { status: 400 })
  }

  const supabase = createServiceClient()
  if (!supabase) {
    return NextResponse.json({ error: 'service unavailable' }, { status: 503 })
  }

  const { data, error } = await supabase.rpc('apply_payment_callback', {
    p_provider: name,
    p_provider_ref: verification.providerRef ?? null,
    p_status: verification.status,
    p_payment_id: readPaymentId(payload),
    p_card_token: verification.cardToken ?? null,
    p_card_last4: verification.cardLast4 ?? null,
    p_card_brand: verification.cardBrand ?? null,
    p_failure: verification.failureReason ?? null,
  })

  if (error) {
    console.error(`[paiement:${name}] application refusée`, error)
    return NextResponse.json({ error: 'apply failed' }, { status: 500 })
  }

  return NextResponse.json(data)
}

/** L'identifiant interne qu'on avait transmis au prestataire, s'il le renvoie. */
function readPaymentId(payload: unknown): string | null {
  if (typeof payload !== 'object' || payload === null) return null
  const record = payload as Record<string, unknown>
  const candidate = record.payment_id ?? record.oid ?? record.orderId
  return typeof candidate === 'string' ? candidate : null
}
