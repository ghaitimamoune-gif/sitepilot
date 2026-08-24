import Image from 'next/image'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getProduct } from '@/lib/menu'
import { ProductForm } from '@/components/product/ProductForm'
import { Eyebrow } from '@/components/ui/Eyebrow'

export const revalidate = 60

type Params = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params
  const product = await getProduct(slug)
  if (!product) return { title: 'Produit introuvable' }
  return {
    title: product.name,
    description: product.description ?? undefined,
  }
}

export default async function ProductPage({ params }: Params) {
  const { slug } = await params
  const product = await getProduct(slug)
  if (!product) notFound()

  return (
    <article>
      {/* §9 : photo pleine largeur. §4.5 : elle fait tout le travail. */}
      <div className="relative aspect-[4/3] w-full bg-eb-cream">
        {product.image_url ? (
          <Image
            src={product.image_url}
            alt={product.name}
            fill
            priority
            sizes="(max-width: 768px) 100vw, 768px"
            className="object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <Eyebrow className="text-eb-grey">photo à venir</Eyebrow>
          </div>
        )}
      </div>

      <div className="px-4 pt-5">
        <h1 className="text-display-l">{product.name}</h1>
        {product.description && (
          <p className="mt-2 text-body-l text-eb-grey">{product.description}</p>
        )}
      </div>

      {product.is_available ? (
        <ProductForm product={product} />
      ) : (
        <p className="mx-4 mt-6 bg-eb-cream px-4 py-3 text-body text-eb-grey">
          Épuisé pour aujourd&apos;hui. Reviens demain.
        </p>
      )}
    </article>
  )
}
