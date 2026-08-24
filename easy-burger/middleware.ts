import type { NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
  return updateSession(request)
}

export const config = {
  matcher: [
    /*
     * Toutes les routes sauf les fichiers statiques, le service worker et
     * le manifeste — qui doivent rester servis sans passer par l'auth.
     */
    '/((?!_next/static|_next/image|favicon.ico|sw\\.js|manifest\\.json|logo|pattern|photos|icons).*)',
  ],
}
