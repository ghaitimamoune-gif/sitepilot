import Image from 'next/image'
import Link from 'next/link'
import { Logo } from '@/components/brand/Logo'
import { EasyPattern } from '@/components/brand/EasyPattern'
import { Eyebrow } from '@/components/ui/Eyebrow'

/**
 * Page d'attente de la Phase 0.
 * Devient le menu en Phase 1 (§9, « Accueil / Menu »).
 */
export default function Home() {
  return (
    <main className="min-h-dvh bg-eb-black text-eb-white">
      <section className="relative overflow-hidden">
        <EasyPattern ink="blanc" opacity={0.05} scale={300} />

        <div className="relative mx-auto flex max-w-lg flex-col gap-6 px-5 pb-10 pt-16">
          <Logo variant="blanc-orange" width={220} priority />

          <h1 className="text-display-xl">
            Take it easy
            <br />
            Take it smashy
          </h1>

          <p className="max-w-sm text-body-l text-eb-cream">
            Smash burgers à Casablanca. Livraison et à emporter, bientôt en
            commande directe — avec des points à chaque visite.
          </p>

          <Eyebrow className="text-eb-orange">Phase 0 · fondations</Eyebrow>

          <Link
            href="/design-system"
            className="w-fit rounded-button bg-eb-orange px-5 py-3 text-body font-semibold text-eb-white"
          >
            Voir le design system
          </Link>
        </div>
      </section>

      <div className="relative aspect-[3/2] w-full">
        <Image
          src="/photos/hero-flatlay.jpg"
          alt="Smash burgers, frites maison, frites de patates douces et beignets"
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
      </div>
    </main>
  )
}
