/**
 * Parcours récompense : le client échange ses points contre un code à
 * 6 chiffres, le caissier le valide, et le code ne repasse pas.
 */
import { chromium } from 'playwright'
import { readFileSync } from 'node:fs'
import { sessionCookie } from './keys.mjs'

const BASE = process.env.BASE ?? 'http://127.0.0.1:3230'
const PHONE = process.env.PHONE ?? '06 88 11 22 33'

const b = await chromium.launch()
const step = (n, ok, extra = '') =>
  console.log(`${ok ? '  OK  ' : 'ÉCHEC '} ${n}${extra ? ' → ' + extra : ''}`)

// ------------------------------------------------------------------- client
const client = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
const p = await client.newPage()
const errs = []
p.on('pageerror', (e) => errs.push(String(e)))

await p.goto(BASE + '/connexion', { waitUntil: 'networkidle' })
await p.getByLabel('téléphone').fill(PHONE)
await p.locator('button[type=submit]').click()
await p.getByLabel('code reçu par SMS').waitFor()
await p.getByLabel('code reçu par SMS').fill('123456')
await p.locator('button[type=submit]').click()
await p.waitForURL('**/fidelite', { timeout: 20000 })

// Sans points, la boutique reste grise.
let body = await p.textContent('body')
step('sans points, les récompenses affichent ce qui manque',
  /encore \d+ points/.test(body))

// On crédite 300 points par la caisse, comme au comptoir.
const staffJwt = readFileSync(new URL('.bin/staff.jwt', import.meta.url), 'utf8').trim()
const res = await fetch('http://127.0.0.1:3003/rest/v1/rpc/credit_ticket_points', {
  method: 'POST',
  headers: {
    apikey: staffJwt,
    Authorization: `Bearer ${staffJwt}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    p_phone: PHONE,
    p_amount_cents: 30000,
    p_ticket_ref: 'RW-' + Math.floor(Math.random() * 100000),
  }),
})
step('300 points crédités au comptoir', (await res.json()).points_credited === 300)

await p.goto(BASE + '/fidelite', { waitUntil: 'networkidle' })
await p.locator('button:has-text("FRITES MAISON")').click()
await p.locator('dialog').waitFor()
step('la feuille de confirmation explique ce qui va se passer',
  /valable 15 minutes/i.test(await p.locator('dialog').textContent()))

await p.locator('dialog button:has-text("Utiliser")').click()
await p.waitForURL('**/code/**', { timeout: 20000 })

body = await p.textContent('body')
const code = (body.match(/(\d{3})\s(\d{3})/) || []).slice(1, 3).join('')
step('code à 6 chiffres affiché', /^\d{6}$/.test(code), code)
step('compte à rebours affiché', /expire dans \d+:\d{2}/.test(body))
await p.screenshot({ path: 'e2e/.bin/shots/code.png', fullPage: true })

await p.goto(BASE + '/fidelite', { waitUntil: 'networkidle' })
body = await p.textContent('body')
step('250 points débités', /mon solde\s*50/i.test(body.replace(/\s+/g, ' ')))
step('le code figure dans « à utiliser au comptoir »',
  /à utiliser au comptoir/i.test(body))
await p.screenshot({ path: 'e2e/.bin/shots/fidelite-code.png', fullPage: true })

// -------------------------------------------------------------------- caisse
const staff = await b.newContext({ viewport: { width: 480, height: 900 }, deviceScaleFactor: 2 })
await staff.addCookies([sessionCookie(staffJwt)])
const s = await staff.newPage()
s.on('pageerror', (e) => errs.push(String(e)))

await s.goto(BASE + '/staff', { waitUntil: 'networkidle' })
await s.getByLabel('code de récompense').fill(code)
await s.locator('form:has([name=code]) button[type=submit]').click()
await s.locator('[role=status]').waitFor({ timeout: 15000 })
let out = (await s.locator('[role=status]').textContent()).replace(/\s+/g, ' ')
step('le caissier valide la récompense', /récompense validée/i.test(out), out.slice(0, 70))
await s.screenshot({ path: 'e2e/.bin/shots/staff-recompense.png', fullPage: true })

await s.goto(BASE + '/staff', { waitUntil: 'networkidle' })
await s.getByLabel('code de récompense').fill(code)
await s.locator('form:has([name=code]) button[type=submit]').click()
await s.locator('[role=status]').waitFor({ timeout: 15000 })
out = (await s.locator('[role=status]').textContent()).replace(/\s+/g, ' ')
step('le même code ne repasse pas', /inconnu ou déjà utilisé/i.test(out), out.slice(0, 70))

// Le client voit sa récompense consommée.
await p.goto(BASE + '/fidelite', { waitUntil: 'networkidle' })
body = await p.textContent('body')
step('le code disparaît des codes en cours', !/à utiliser au comptoir/i.test(body))
step('l’historique montre la récompense utilisée', /Récompense utilisée/i.test(body))

console.log(errs.length ? '\nERREURS : ' + errs.join(' | ') : '\naucune erreur console')
await b.close()
