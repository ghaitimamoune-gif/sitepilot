/**
 * Fait passer PostgREST pour une API Supabase.
 *
 *   /rest/v1/*      → PostgREST
 *   /auth/v1/user   → une session de test si un jeton est présenté
 *   /auth/v1/*      → 401
 *
 * STAFF_USER_ID : l'UUID renvoyé comme utilisateur connecté.
 */
import http from 'node:http'

const TARGET = process.env.PGRST_URL ?? 'http://127.0.0.1:3002'
const PORT = Number(process.env.PROXY_PORT ?? 3003)
const STAFF_USER_ID = process.env.STAFF_USER_ID ?? ''

http
  .createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://x')

      if (url.pathname.startsWith('/auth/v1/')) {
        const token = (req.headers.authorization ?? '').split(' ')[1]
        if (url.pathname.endsWith('/user') && token?.includes('.') && STAFF_USER_ID) {
          return json(res, 200, {
            id: STAFF_USER_ID,
            aud: 'authenticated',
            role: 'authenticated',
            email: 'staff@easyburger.test',
            app_metadata: {},
            user_metadata: {},
            created_at: '2026-01-01T00:00:00Z',
          })
        }
        return json(res, 401, { message: 'no session (stub)' })
      }

      if (!url.pathname.startsWith('/rest/v1/')) return json(res, 404, {})

      const chunks = []
      for await (const c of req) chunks.push(c)

      const headers = { ...req.headers }
      delete headers.host
      delete headers['content-length']

      const upstream = await fetch(
        TARGET + url.pathname.replace('/rest/v1', '') + url.search,
        {
          method: req.method,
          headers,
          body: ['GET', 'HEAD'].includes(req.method) ? undefined : Buffer.concat(chunks),
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

function json(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json' })
  res.end(JSON.stringify(body))
}
