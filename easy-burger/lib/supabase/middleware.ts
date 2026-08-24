import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { SUPABASE_ANON_KEY, SUPABASE_URL, isSupabaseConfigured } from './config'

/** Routes réservées au personnel. Jamais mises en cache par le SW non plus. */
const STAFF_PREFIXES = ['/admin', '/staff']
const LOGIN_PATH = '/admin/login'

/**
 * Rafraîchit la session Supabase et garde les routes du personnel.
 *
 * Le contrôle fin des rôles est fait en base par les policies RLS et par les
 * fonctions `security definer` : ce middleware ne fait que rediriger un
 * visiteur non connecté vers la page de connexion. Il n'est pas la sécurité,
 * il est le confort.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request })

  const path = request.nextUrl.pathname
  const isStaffRoute = STAFF_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`))

  if (!isSupabaseConfigured) {
    // Sans base, on laisse passer : les écrans affichent un message explicite
    // plutôt qu'une redirection en boucle vers une connexion impossible.
    return response
  }

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        )
      },
    },
  })

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (isStaffRoute && path !== LOGIN_PATH && !user) {
    const url = request.nextUrl.clone()
    url.pathname = LOGIN_PATH
    url.searchParams.set('suite', path)
    return NextResponse.redirect(url)
  }

  if (path === LOGIN_PATH && user) {
    const url = request.nextUrl.clone()
    url.pathname = '/admin'
    url.search = ''
    return NextResponse.redirect(url)
  }

  return response
}
