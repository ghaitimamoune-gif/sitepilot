import type { Metadata } from 'next'
import { GlovoClaimForm } from '@/components/claim/GlovoClaimForm'
import { EasyPattern } from '@/components/brand/EasyPattern'
import { Eyebrow } from '@/components/ui/Eyebrow'

export const metadata: Metadata = { title: 'Récupérer mes points' }
export const dynamic = 'force-dynamic'

/**
 * §6.4c — la page que le QR du sticker ouvre.
 *
 * C'est le point de bascule du projet : un client Glovo qui arrive ici
 * devient un client identifié. Donc un seul écran, deux champs, aucun compte
 * à créer.
 */
export default async function BagPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string }>
}) {
  const { c } = await searchParams

  return (
    <div className="px-4 pt-6">
      <section className="relative overflow-hidden bg-eb-black px-5 py-8 text-eb-white">
        <EasyPattern ink="blanc" opacity={0.07} scale={200} />
        <div className="relative">
          <Eyebrow className="text-eb-orange">code sur ton sac</Eyebrow>
          <h1 className="mt-1 text-display-l">Récupère tes points</h1>
          <p className="mt-2 max-w-sm text-body text-eb-cream">
            Ta commande Glovo compte aussi. Recopie le code du sticker, laisse
            ton numéro, c’est tout.
          </p>
        </div>
      </section>

      <div className="mt-8 max-w-sm">
        <GlovoClaimForm defaultCode={c ?? ''} />
      </div>
    </div>
  )
}
