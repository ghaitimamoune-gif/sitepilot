import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getRedemption, rewardTitle } from '@/lib/rewards'
import { CodeCountdown } from '@/components/loyalty/CodeCountdown'
import { Eyebrow } from '@/components/ui/Eyebrow'

export const metadata: Metadata = { title: 'Ma récompense', robots: { index: false } }
export const dynamic = 'force-dynamic'

/**
 * §9 — « Écran plein orange, code à 6 chiffres en display, compte à rebours
 * 15 minutes. »
 *
 * C'est l'écran qu'on tend au caissier : rien d'autre ne doit s'y trouver.
 */
export default async function CodePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const redemption = await getRedemption(id)
  if (!redemption) notFound()

  const used = redemption.status !== 'issued'
  const expired = new Date(redemption.expires_at).getTime() <= Date.now()

  return (
    <div className="-mx-4 -mt-0">
      <section
        className={`flex min-h-[70dvh] flex-col items-center justify-center gap-4 px-5 py-16 text-center ${
          used || expired ? 'bg-eb-cream text-eb-grey' : 'bg-eb-orange text-eb-white'
        }`}
      >
        <Eyebrow>{rewardTitle(redemption)}</Eyebrow>

        {used ? (
          <>
            <p className="font-display text-display-l uppercase">
              {redemption.status === 'used' ? 'Déjà utilisée' : 'Code expiré'}
            </p>
            {redemption.status === 'expired' && redemption.points_spent > 0 && (
              <p className="text-body">
                Tes {redemption.points_spent} points t’ont été rendus.
              </p>
            )}
          </>
        ) : (
          <>
            <Eyebrow>code à donner en caisse</Eyebrow>
            <p className="eb-price font-display text-[4rem] leading-none tracking-[0.06em]">
              {redemption.code.slice(0, 3)} {redemption.code.slice(3)}
            </p>
            <CodeCountdown expiresAt={redemption.expires_at} />
          </>
        )}
      </section>

      <div className="px-4 py-6 text-center">
        <Link href="/fidelite" className="eb-eyebrow font-util text-eb-grey">
          retour à ma fidélité
        </Link>
      </div>
    </div>
  )
}
