import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { getSupabaseEnv, missingSupabaseEnvVars } from '@/lib/supabase/env'

// Jamais mis en cache : chaque appel doit provoquer une vraie requête vers la
// base. Une réponse servie depuis un cache ne compterait pas comme activité et
// laisserait le projet Supabase se mettre en veille.
export const dynamic = 'force-dynamic'
export const revalidate = 0

/**
 * Point de contrôle santé — sert aussi de maintien en éveil.
 *
 * Supabase suspend les projets de l'offre gratuite après plusieurs jours sans
 * activité. Une requête périodique sur cette route effectue un aller-retour
 * réel vers PostgREST, ce qui remet le compteur d'inactivité à zéro.
 *
 * La route est publique et volontairement sans effet de bord : elle lit une
 * seule colonne, sur une table protégée par RLS. Avec la clé anonyme et sans
 * session, la requête ne renvoie aucune ligne — mais elle atteint bien la base.
 */
export async function GET() {
  const env = getSupabaseEnv()

  if (!env) {
    return NextResponse.json(
      {
        status: 'misconfigured',
        database: 'unknown',
        missing: missingSupabaseEnvVars(),
        checkedAt: new Date().toISOString(),
      },
      { status: 503, headers: { 'Cache-Control': 'no-store' } }
    )
  }

  const supabase = createClient(env.url, env.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const startedAt = Date.now()

  try {
    const { error } = await supabase.from('projects').select('id').limit(1)
    const latencyMs = Date.now() - startedAt

    if (error) {
      // Le détail reste dans les journaux du serveur : cette route est publique,
      // inutile d'exposer la structure de la base ou le motif exact du refus.
      console.error('[health] Requête Supabase en échec :', error.message)
      return NextResponse.json(
        { status: 'degraded', database: 'unreachable', latencyMs, checkedAt: new Date().toISOString() },
        { status: 503, headers: { 'Cache-Control': 'no-store' } }
      )
    }

    return NextResponse.json(
      { status: 'ok', database: 'reachable', latencyMs, checkedAt: new Date().toISOString() },
      { status: 200, headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (err) {
    console.error('[health] Base injoignable :', err)
    return NextResponse.json(
      {
        status: 'degraded',
        database: 'unreachable',
        latencyMs: Date.now() - startedAt,
        checkedAt: new Date().toISOString(),
      },
      { status: 503, headers: { 'Cache-Control': 'no-store' } }
    )
  }
}
