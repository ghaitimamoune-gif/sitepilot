/**
 * Résolution centralisée des variables d'environnement Supabase.
 *
 * Historiquement le code utilisait `process.env.NEXT_PUBLIC_SUPABASE_URL!`.
 * L'assertion `!` ment au compilateur : si la variable manque en production,
 * `createServerClient()` lève une exception. Comme le middleware s'exécute sur
 * *toutes* les routes, cette exception transformait l'application entière en
 * erreur 500 — y compris la page de connexion. Le site devenait injoignable
 * sans aucun message exploitable.
 *
 * Ce module rend la configuration explicite et vérifiable.
 */

export const SUPABASE_ENV_VARS = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
] as const

export interface SupabaseEnv {
  url: string
  anonKey: string
}

/**
 * Les variables `NEXT_PUBLIC_*` sont inlinées au build par Next.js : elles
 * doivent être lues via un accès statique à `process.env.X`, jamais via un
 * index dynamique, sinon la substitution n'a pas lieu côté navigateur.
 */
function readEnv(): { url?: string; anonKey?: string } {
  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || undefined,
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() || undefined,
  }
}

/** Liste les variables Supabase absentes, pour un diagnostic lisible. */
export function missingSupabaseEnvVars(): string[] {
  const { url, anonKey } = readEnv()
  const missing: string[] = []
  if (!url) missing.push('NEXT_PUBLIC_SUPABASE_URL')
  if (!anonKey) missing.push('NEXT_PUBLIC_SUPABASE_ANON_KEY')
  return missing
}

/** `true` si l'application dispose de quoi contacter Supabase. */
export function isSupabaseConfigured(): boolean {
  return missingSupabaseEnvVars().length === 0
}

/**
 * Renvoie la configuration, ou `null` si elle est incomplète.
 * Les appelants qui peuvent dégrader proprement utilisent cette variante.
 */
export function getSupabaseEnv(): SupabaseEnv | null {
  const { url, anonKey } = readEnv()
  if (!url || !anonKey) return null
  return { url, anonKey }
}

/**
 * Variante stricte : lève une erreur nommant précisément les variables
 * manquantes, au lieu du message générique de la librairie Supabase.
 */
export function requireSupabaseEnv(): SupabaseEnv {
  const env = getSupabaseEnv()
  if (!env) {
    throw new Error(
      `Configuration Supabase incomplète. Variable(s) manquante(s) : ${missingSupabaseEnvVars().join(', ')}. ` +
        `Ajoutez-les dans Netlify → Site settings → Environment variables, ou dans un fichier .env.local en développement.`
    )
  }
  return env
}
