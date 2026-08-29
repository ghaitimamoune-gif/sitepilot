'use client'
import { createBrowserClient } from '@supabase/ssr'
import { requireSupabaseEnv } from './env'

export { isSupabaseConfigured, missingSupabaseEnvVars } from './env'

/**
 * Client Supabase côté navigateur.
 *
 * Les variables `NEXT_PUBLIC_*` sont inlinées au moment du build : si le build
 * de production a été lancé sans elles, elles resteront absentes au runtime
 * même après les avoir ajoutées dans Netlify — il faut relancer un déploiement.
 * Le message d'erreur ci-dessous rend ce cas identifiable.
 */
export function createClient() {
  const { url, anonKey } = requireSupabaseEnv()
  return createBrowserClient(url, anonKey)
}
