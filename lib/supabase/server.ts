import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getSupabaseEnv, requireSupabaseEnv } from './env'

export { isSupabaseConfigured, missingSupabaseEnvVars } from './env'

type CookieToSet = { name: string; value: string; options: CookieOptions }

async function build(url: string, anonKey: string) {
  const cookieStore = await cookies()
  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet: CookieToSet[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
        } catch {
          // Appelé depuis un Server Component : les cookies sont en lecture
          // seule. Le middleware rafraîchit la session, on peut ignorer.
        }
      },
    },
  })
}

/**
 * Client Supabase côté serveur.
 * Lève une erreur explicite (nommant les variables manquantes) si la
 * configuration est incomplète.
 */
export async function createClient() {
  const { url, anonKey } = requireSupabaseEnv()
  return build(url, anonKey)
}

/**
 * Variante non levante : renvoie `null` si la configuration est absente.
 * À utiliser dans les pages qui savent afficher un écran de configuration.
 */
export async function createClientOrNull() {
  const env = getSupabaseEnv()
  if (!env) return null
  return build(env.url, env.anonKey)
}
