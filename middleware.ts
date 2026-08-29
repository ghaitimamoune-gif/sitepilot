import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { getSupabaseEnv } from '@/lib/supabase/env'

type CookieToSet = { name: string; value: string; options: CookieOptions }

/**
 * Le middleware s'exécute sur *toutes* les requêtes : c'est le point le plus
 * fragile de l'application. Toute exception levée ici renvoie une 500 sur
 * l'intégralité du site, page de connexion comprise.
 *
 * Il est donc écrit pour ne jamais lever d'exception : configuration absente
 * ou Supabase injoignable dégradent le comportement (les pages affichent un
 * diagnostic) au lieu de rendre l'application inaccessible.
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const isAuthRoute = pathname.startsWith('/auth')
  const isProtectedRoute = pathname.startsWith('/dashboard') || pathname.startsWith('/project')

  const env = getSupabaseEnv()

  // Configuration incomplète : on laisse passer la requête. Les pages rendent
  // un écran de configuration explicite plutôt qu'une 500 opaque.
  if (!env) {
    console.error(
      '[middleware] Configuration Supabase absente — contrôle d\'authentification désactivé. ' +
        'Renseignez NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY.'
    )
    return NextResponse.next({ request })
  }

  let response = NextResponse.next({ request })

  const supabase = createServerClient(env.url, env.anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet: CookieToSet[]) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
      },
    },
  })

  let user = null
  try {
    const { data } = await supabase.auth.getUser()
    user = data.user
  } catch (err) {
    // Supabase injoignable (panne réseau, projet en pause, clé révoquée).
    // On considère la session comme non authentifiée : les routes protégées
    // renvoient vers la connexion, qui affichera l'erreur réelle.
    console.error('[middleware] Vérification de session impossible :', err)
  }

  if (!user && isProtectedRoute) {
    return NextResponse.redirect(new URL('/auth/login', request.url))
  }
  if (user && isAuthRoute) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
