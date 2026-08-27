import Link from 'next/link'
import type { Metadata } from 'next'
import { getStaffUser, isAtLeast, ROLE_LABELS } from '@/lib/staff'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { signOut } from '@/app/actions/staff'
import { Logo } from '@/components/brand/Logo'
import { Eyebrow } from '@/components/ui/Eyebrow'

export const metadata: Metadata = {
  title: 'Back-office',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const staff = await getStaffUser()

  return (
    <div className="min-h-dvh bg-eb-white">
      <header className="border-b border-eb-line bg-eb-black text-eb-white pt-safe">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <Link href="/admin" className="flex items-center gap-3">
            <Logo variant="blanc-orange" width={110} />
            <Eyebrow className="text-eb-cream">back-office</Eyebrow>
          </Link>

          {staff && (
            <div className="flex items-center gap-4">
              <Eyebrow className="text-eb-cream">
                {staff.name} · {ROLE_LABELS[staff.role]}
              </Eyebrow>
              <form action={signOut}>
                <button className="eb-eyebrow font-util text-eb-orange">
                  déconnexion
                </button>
              </form>
            </div>
          )}
        </div>

        {staff && (
          <nav className="no-scrollbar mx-auto flex max-w-5xl gap-1 overflow-x-auto px-3 pb-2">
            <AdminLink href="/admin">Commandes</AdminLink>
            {isAtLeast(staff, 'admin') && (
              <AdminLink href="/admin/clients">Clients</AdminLink>
            )}
            {isAtLeast(staff, 'manager') && (
              <>
                <AdminLink href="/admin/menu">Menu</AdminLink>
                <AdminLink href="/admin/codes">Codes sac</AdminLink>
                <AdminLink href="/admin/tickets">Tickets</AdminLink>
                <AdminLink href="/admin/stats">Bilan</AdminLink>
              </>
            )}
            {isAtLeast(staff, 'admin') && (
              <>
                <AdminLink href="/admin/fidelite">Fidélité</AdminLink>
                <AdminLink href="/admin/reglages">Réglages</AdminLink>
                <AdminLink href="/admin/journal">Journal</AdminLink>
              </>
            )}
            {isAtLeast(staff, 'superadmin') && (
              <AdminLink href="/admin/equipe">Équipe</AdminLink>
            )}
            <AdminLink href="/staff">Caisse</AdminLink>
          </nav>
        )}
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6">
        {!isSupabaseConfigured ? <NoDatabase /> : children}
      </main>
    </div>
  )
}

function AdminLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="eb-eyebrow inline-flex h-9 shrink-0 items-center whitespace-nowrap px-3 font-util text-eb-cream"
    >
      {children}
    </Link>
  )
}

function NoDatabase() {
  return (
    <div className="bg-eb-cream px-5 py-10 text-center">
      <Eyebrow className="text-eb-grey">base non branchée</Eyebrow>
      <p className="mx-auto mt-3 max-w-md text-body text-eb-grey">
        Renseigne <span className="eb-price">NEXT_PUBLIC_SUPABASE_URL</span> et{' '}
        <span className="eb-price">NEXT_PUBLIC_SUPABASE_ANON_KEY</span>, joue les
        migrations, puis crée le premier superadmin — la procédure est en
        commentaire à la fin de{' '}
        <span className="eb-price">supabase/migrations/001_staff.sql</span>.
      </p>
    </div>
  )
}
