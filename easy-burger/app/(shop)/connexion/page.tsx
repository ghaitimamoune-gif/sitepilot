import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getCurrentCustomer } from '@/lib/customer'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { OtpForm } from '@/components/account/OtpForm'
import { EasyPattern } from '@/components/brand/EasyPattern'
import { Eyebrow } from '@/components/ui/Eyebrow'

export const metadata: Metadata = { title: 'Connexion' }
export const dynamic = 'force-dynamic'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ suite?: string }>
}) {
  const { suite } = await searchParams
  const customer = await getCurrentCustomer()
  if (customer) redirect(suite ?? '/fidelite')

  return (
    <div className="px-4 pt-6">
      <section className="relative overflow-hidden bg-eb-black px-5 py-8 text-eb-white">
        <EasyPattern ink="blanc" opacity={0.07} scale={200} />
        <div className="relative">
          <Eyebrow className="text-eb-orange">fidélité easy burger</Eyebrow>
          <h1 className="mt-1 text-display-l">1 dirham = 1 point</h1>
          <p className="mt-2 max-w-sm text-body text-eb-cream">
            10 points valent 1 dirham de récompense. Ton numéro suffit : les
            points tombent aussi quand tu commandes au comptoir.
          </p>
        </div>
      </section>

      {isSupabaseConfigured ? (
        <div className="mt-8 max-w-sm">
          <OtpForm redirectTo={suite ?? '/fidelite'} />
        </div>
      ) : (
        <p className="mt-8 bg-eb-cream px-4 py-3 text-body text-eb-grey">
          La connexion n’est pas encore activée.
        </p>
      )}
    </div>
  )
}
