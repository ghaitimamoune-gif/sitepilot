import 'server-only'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { SUPABASE_URL } from './config'

/**
 * Client à clé de service.
 *
 * Réservé à ce qui n'a pas d'utilisateur : callbacks de paiement, jobs
 * nocturnes. Il contourne RLS, donc il ne doit JAMAIS être créé dans un
 * chemin de code atteignable par une requête d'utilisateur, et la clé ne
 * doit jamais porter le préfixe NEXT_PUBLIC_.
 */
export function createServiceClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!SUPABASE_URL || !key) return null

  return createSupabaseClient(SUPABASE_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
