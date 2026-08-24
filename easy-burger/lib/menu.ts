import { createClient } from './supabase/server'
import type { Category, Product } from '@/types/db'

/**
 * Le menu vit en base (§5). Ces fonctions renvoient un tableau vide quand
 * Supabase n'est pas branché — l'app affiche alors un écran vide explicite
 * plutôt que de tomber.
 */
export async function getMenu(): Promise<Category[]> {
  const supabase = await createClient()
  if (!supabase) return []

  const { data, error } = await supabase
    .from('categories')
    .select(
      `id, slug, name, sort_order,
       products ( id, slug, name, description, price_cents, image_url,
                  sort_order, is_available, is_featured )`,
    )
    .eq('is_active', true)
    .order('sort_order')

  if (error || !data) return []

  return (data as unknown as Category[])
    .map((c) => ({
      ...c,
      products: [...(c.products ?? [])].sort((a, b) => a.sort_order - b.sort_order),
    }))
    .filter((c) => c.products.length > 0)
}

export async function getProduct(slug: string): Promise<Product | null> {
  const supabase = await createClient()
  if (!supabase) return null

  const { data, error } = await supabase
    .from('products')
    .select(
      `id, slug, name, description, price_cents, image_url, sort_order,
       is_available, is_featured,
       options:product_options ( id, name, type, is_required, sort_order,
         values:product_option_values ( id, name, price_delta_cents, is_available, sort_order ) )`,
    )
    .eq('slug', slug)
    .maybeSingle()

  if (error || !data) return null

  const product = data as unknown as Product
  product.options = [...(product.options ?? [])]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((o) => ({
      ...o,
      values: [...(o.values ?? [])]
        .filter((v) => v.is_available)
        .sort((a, b) => a.sort_order - b.sort_order),
    }))

  return product
}
