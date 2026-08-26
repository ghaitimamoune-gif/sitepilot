import { chromium } from 'playwright'
import { readFileSync } from 'node:fs'
import { mkdirSync } from 'node:fs'
import { sessionCookie } from './keys.mjs'

const BASE = process.env.BASE ?? 'http://127.0.0.1:3230'
const jwt = readFileSync(new URL('.bin/staff.jwt', import.meta.url), 'utf8').trim()

const b = await chromium.launch()
const ctx = await b.newContext({ viewport: { width: 480, height: 900 }, deviceScaleFactor: 2 })
await ctx.addCookies([sessionCookie(jwt)])
const p = await ctx.newPage()
const errs = []
p.on('pageerror', (e) => errs.push(String(e)))

const SHOTS = new URL('.bin/shots/', import.meta.url)
mkdirSync(SHOTS, { recursive: true })

const ref = 'Z-' + Math.floor(Math.random() * 10000)
const step = (n, ok, extra = '') => console.log(`${ok ? '  OK  ' : 'ÉCHEC '} ${n}${extra ? ' → ' + extra : ''}`)

async function credit(phone, amount, ticket) {
  await p.goto(BASE + '/staff', { waitUntil: 'networkidle' })
  await p.getByLabel('téléphone du client').fill(phone)
  await p.getByLabel('montant du ticket').fill(amount)
  await p.getByLabel('numéro de ticket').fill(ticket)
  await p.locator('button[type=submit]').click()
  await p.locator('[role=status]').waitFor({ timeout: 15000 })
  await p.waitForTimeout(300)
  return (await p.locator('[role=status]').textContent()).replace(/\s+/g, ' ').trim()
}

// 1er crédit
let out = await credit('06 55 12 34 56', '74,50', ref)
step('premier crédit accepté', out.includes('+74'), out)
await p.screenshot({ path: new URL('staff-credit-ok.png', SHOTS).pathname, fullPage: true })

// 2e crédit, même ticket écrit autrement
out = await credit('06 55 12 34 56', '74,50', ref.toLowerCase().replace('-', ' '))
step('même ticket refusé, même écrit autrement', /déjà été crédité/.test(out), out)
await p.screenshot({ path: new URL('staff-credit-refus.png', SHOTS).pathname, fullPage: true })

// Autre client, même ticket
out = await credit('06 99 88 77 66', '74,50', ref)
step('même ticket sur un autre client refusé', /déjà été crédité/.test(out), out)

// Montant illisible
out = await credit('06 55 12 34 56', '74,5O', 'Z-9999')
step('montant illisible refusé', /chiffres/.test(out), out)

console.log(errs.length ? 'ERREURS: ' + errs.join(' | ') : 'aucune erreur console')
await b.close()
