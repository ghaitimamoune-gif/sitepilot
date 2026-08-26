/**
 * Fabrique des jetons au format Supabase, signés avec le secret du banc
 * d'essai. `anon` sert de clé publique, `authenticated` porte le `sub` d'un
 * membre du personnel.
 *
 *   node e2e/keys.mjs anon
 *   node e2e/keys.mjs authenticated <uuid>
 */
import crypto from 'node:crypto'

export const SECRET =
  process.env.JWT_SECRET ?? 'un-secret-de-test-suffisamment-long-pour-postgrest-0123456789'

export function mint(role, sub, extra = {}) {
  const enc = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
  const head = enc({ alg: 'HS256', typ: 'JWT' })
  const body = enc({ role, sub, iat: 1700000000, exp: 2000000000, ...extra })
  const sig = crypto.createHmac('sha256', SECRET).update(`${head}.${body}`).digest('base64url')
  return `${head}.${body}.${sig}`
}

/** Cookie de session lu par @supabase/ssr. */
export function sessionCookie(accessToken, host = '127.0.0.1') {
  const session = {
    access_token: accessToken,
    refresh_token: 'stub',
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: 2000000000,
    user: { id: 'stub', aud: 'authenticated', role: 'authenticated' },
  }
  return {
    name: `sb-${host.split('.')[0]}-auth-token`,
    value: 'base64-' + Buffer.from(JSON.stringify(session)).toString('base64'),
    domain: host,
    path: '/',
  }
}

if (process.argv[1]?.endsWith('keys.mjs')) {
  console.log(mint(process.argv[2] ?? 'anon', process.argv[3]))
}
