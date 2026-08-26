/**
 * Fait passer PostgREST pour une API Supabase.
 *
 *   /rest/v1/*      → PostgREST
 *   /auth/v1/user   → une session de test si un jeton est présenté
 *   /auth/v1/*      → 401
 *
 * STAFF_USER_ID : l'UUID renvoyé comme utilisateur connecté (back-office).
 *
 * Le bouchon GoTrue accepte aussi la connexion client par OTP : n'importe
 * quel numéro, code fixe 123456. Il crée la ligne auth.users correspondante
 * et renvoie une session signée comme le ferait Supabase, de sorte que le
 * parcours de connexion est testable pour de vrai.
 */
const OTP_CODE = '123456'
const PGPORT = process.env.PGPORT ?? '5439'

/** Crée (ou retrouve) l'utilisateur Auth d'un numéro, et renvoie son UUID. */
function authUserForPhone(phone) {
  const sql = `
    insert into auth.users (email) values ('${phone}@otp.test')
    on conflict (email) do update set email = excluded.email
    returning id;`
  // psql ajoute l'étiquette de commande (« INSERT 0 1 ») après la ligne
  // renvoyée : on ne garde que la première.
  return execFileSync(
    'psql',
    ['-h', '/tmp', '-p', PGPORT, '-U', 'postgres', '-tAc', sql],
    { encoding: 'utf8' },
  )
    .split('\n')[0]
    .trim()
}
import http from 'node:http'
import { execFileSync } from 'node:child_process'
import { mint } from './keys.mjs'

const TARGET = process.env.PGRST_URL ?? 'http://127.0.0.1:3002'
const PORT = Number(process.env.PROXY_PORT ?? 3003)
const STAFF_USER_ID = process.env.STAFF_USER_ID ?? ''

http
  .createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://x')

      if (url.pathname.startsWith('/auth/v1/')) {
        // Envoi du code : on fait comme si le SMS partait.
        if (url.pathname.endsWith('/otp')) return json(res, 200, {})

        // Vérification du code : session signée si le code est le bon.
        if (url.pathname.endsWith('/verify')) {
          const body = JSON.parse(await readBody(req) || '{}')
          if (body.token !== OTP_CODE) {
            return json(res, 403, { error: 'invalid_otp', message: 'Token has expired or is invalid' })
          }
          const id = authUserForPhone(body.phone.replace(/\D/g, ''))
          const access = mint('authenticated', id, { phone: body.phone })
          return json(res, 200, {
            access_token: access,
            token_type: 'bearer',
            expires_in: 3600,
            expires_at: 2000000000,
            refresh_token: 'stub-refresh',
            user: {
              id,
              aud: 'authenticated',
              role: 'authenticated',
              phone: body.phone.replace(/^\+/, ''),
              app_metadata: {},
              user_metadata: {},
              created_at: '2026-01-01T00:00:00Z',
            },
          })
        }

        const token = (req.headers.authorization ?? '').split(' ')[1]
        if (url.pathname.endsWith('/user') && token?.includes('.')) {
          // L'utilisateur est celui que porte le jeton, pas un UUID figé :
          // sinon toute session ressemble à celle du back-office.
          const claims = decodeClaims(token)
          const id = claims.sub || STAFF_USER_ID
          if (!id) return json(res, 401, { message: 'no subject' })
          return json(res, 200, {
            id,
            aud: 'authenticated',
            role: 'authenticated',
            email: 'staff@easyburger.test',
            phone: (claims.phone ?? '').replace(/^\+/, ''),
            app_metadata: {},
            user_metadata: {},
            created_at: '2026-01-01T00:00:00Z',
          })
        }
        return json(res, 401, { message: 'no session (stub)' })
      }

      if (!url.pathname.startsWith('/rest/v1/')) return json(res, 404, {})

      const body = await readBody(req)

      const headers = { ...req.headers }
      delete headers.host
      delete headers['content-length']

      const upstream = await fetch(
        TARGET + url.pathname.replace('/rest/v1', '') + url.search,
        {
          method: req.method,
          headers,
          body: ['GET', 'HEAD'].includes(req.method) ? undefined : body,
        },
      )

      res.writeHead(upstream.status, {
        'content-type': upstream.headers.get('content-type') ?? 'application/json',
      })
      res.end(await upstream.text())
    } catch (err) {
      // Un proxy de test qui meurt sur une requête en vol fait perdre plus de
      // temps qu'il n'en fait gagner.
      json(res, 502, { message: String(err) })
    }
  })
  .listen(PORT, () => console.log(`proxy supabase → http://127.0.0.1:${PORT}`))

/** Lit la charge utile d'un JWT sans vérifier sa signature (banc d'essai). */
function decodeClaims(token) {
  try {
    return JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'))
  } catch {
    return {}
  }
}

async function readBody(req) {
  const chunks = []
  for await (const c of req) chunks.push(c)
  return Buffer.concat(chunks).toString('utf8')
}

function json(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json' })
  res.end(JSON.stringify(body))
}
