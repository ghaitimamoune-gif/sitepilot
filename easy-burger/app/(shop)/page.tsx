import Link from 'next/link'
import Image from 'next/image'
import { getMenu } from '@/lib/menu'
import { getSetting } from '@/lib/settings'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { ProductCard } from '@/components/product/ProductCard'
import { EasyPattern } from '@/components/brand/EasyPattern'
import { Eyebrow } from '@/components/ui/Eyebrow'
import { CategoryNav } from '@/components/product/CategoryNav'

// Le menu et les prix doivent être frais : on ne fige pas la page.
export const revalidate = 60

export default async function MenuPage() {
  const [menu, accepting] = await Promise.all([
    getMenu(),
    getSetting<boolean>('is_accepting_orders'),
  ])

  return (
    <>
      <Hero />

      {accepting === false && (
        <p className="mx-4 mt-4 bg-eb-black px-4 py-3 text-body text-eb-white">
          Les commandes en ligne sont fermées pour le moment. Le menu reste
          consultable.
        </p>
      )}

      {menu.length === 0 ? (
        <EmptyMenu />
      ) : (
        <>
          <CategoryNav
            categories={menu.map((c) => ({ slug: c.slug, name: c.name }))}
          />

          {menu.map((category) => (
            <section
              key={category.id}
              id={category.slug}
              className="scroll-mt-28 px-4 pt-8"
            >
              <h2 className="mb-4 text-display-l">{category.name}</h2>

              <div className="grid grid-cols-2 gap-x-4 gap-y-8">
                {category.products.map((p) => (
                  <Link
                    key={p.id}
                    href={`/p/${p.slug}`}
                    className="block"
                    aria-label={p.name}
                  >
                    <ProductCard
                      name={p.name}
                      description={p.description}
                      priceCents={p.price_cents}
                      imageUrl={p.image_url}
                      available={p.is_available}
                    />
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </>
      )}
    </>
  )
}

function Hero() {
  return (
    <section className="relative aspect-[4/3] w-full overflow-hidden bg-eb-black sm:aspect-[16/9]">
      <Image
        src="/photos/hero-flatlay.jpg"
        alt="Smash burgers, frites maison, frites de patates douces et beignets"
        fill
        priority
        sizes="(max-width: 768px) 100vw, 768px"
        className="object-cover"
      />
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-eb-black to-transparent p-5 pt-16">
        <h1 className="text-display-xl text-eb-white">
          Take it easy
          <br />
          Take it smashy
        </h1>
      </div>
    </section>
  )
}

function EmptyMenu() {
  return (
    <section className="relative m-4 overflow-hidden bg-eb-cream px-5 py-16 text-center">
      <EasyPattern ink="orange" opacity={0.12} scale={200} />
      <div className="relative flex flex-col items-center gap-3">
        <Eyebrow className="text-eb-grey">menu indisponible</Eyebrow>
        <p className="max-w-sm text-body text-eb-grey">
          {isSupabaseConfigured
            ? 'Aucun produit actif en base. Ajoute-les depuis le back-office.'
            : 'La base n’est pas encore branchée. Renseigne NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY, puis joue les migrations.'}
        </p>
      </div>
    </section>
  )
}
