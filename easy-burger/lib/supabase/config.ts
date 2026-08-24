export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''

/**
 * La Phase 0 (design system + coquille PWA) tourne sans Supabase.
 * Tout appel à la base passe par ce garde : pas de crash au build ni au
 * premier rendu quand les variables ne sont pas encore branchées.
 */
export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY)
