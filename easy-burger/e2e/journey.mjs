import { chromium } from 'playwright'

const BASE = process.env.BASE ?? 'http://127.0.0.1:3230'
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
const errs = []
p.on('pageerror', (e) => errs.push(String(e)))
p.on('console', (m) => m.type() === 'error' && errs.push(m.text()))

// Numéro tiré au hasard : le prénom n'est demandé qu'à un client qui n'en a
// pas encore, donc rejouer avec un numéro déjà nommé ne prouverait rien.
const PHONE = '06 55 ' + String(Math.floor(Math.random() * 1e6)).padStart(6, '0').replace(/(\d{2})(?=\d)/g, '$1 ').trim()

const step = (n, ok, extra = '') =>
  console.log(`${ok ? '  OK  ' : 'ÉCHEC '} ${n}${extra ? ' → ' + extra : ''}`)

// 1. Menu
await p.goto(BASE + '/', { waitUntil: 'networkidle' })
step('menu affiche les 4 catégories',
  (await p.locator('nav[aria-label="Catégories"] a').count()) === 4)

// 2. Produit + options
await p.getByLabel('Double cheeseburger').first().click()
await p.waitForURL('**/p/double-cheeseburger')
step('page produit ouverte', p.url().endsWith('/p/double-cheeseburger'))

// Prix de base 75 MAD
let cta = await p.locator('button:has-text("Ajouter ·")').textContent()
step('prix de base affiché', cta.includes('75 MAD'), cta.trim())

// + Bacon de bœuf (15 MAD)
await p.getByText('Bacon de bœuf', { exact: true }).click()
cta = await p.locator('button:has-text("Ajouter ·")').textContent()
step('option répercutée en temps réel', cta.includes('90 MAD'), cta.trim())

// Quantité 2
await p.getByLabel('Ajouter un', { exact: true }).click()
cta = await p.locator('button:has-text("Ajouter ·")').textContent()
step('quantité répercutée', cta.includes('180 MAD'), cta.trim())

await p.locator('button:has-text("Ajouter ·")').click()
await p.waitForURL('**/panier')

// 3. Panier
step('panier affiche la ligne', (await p.locator('li:has-text("Double cheeseburger")').count()) === 1)
step('options rappelées dans le panier',
  (await p.locator('text=Bacon de bœuf').count()) > 0)

// Le panier survit à un rechargement
await p.reload({ waitUntil: 'networkidle' })
step('panier persistant après rechargement',
  (await p.locator('li:has-text("Double cheeseburger")').count()) === 1)

await p.locator('button:has-text("Commander ·")').click()
await p.waitForURL('**/commande')

// 4. Checkout
step('checkout ouvert', p.url().endsWith('/commande'))

// §8 : le prénom n'est plus demandé ici, il l'est après la commande.
step('le checkout ne demande pas le prénom',
  (await p.getByLabel('prénom').count()) === 0)

// Refus attendu : téléphone illisible
await p.getByLabel('téléphone').fill('abc')
await p.getByLabel('adresse de livraison').fill('12 rue Test, Casablanca')
await p.locator('button[type=submit]').click()
const formAlert = p.locator('form [role=alert]')
await formAlert.waitFor({ timeout: 10000 })
const alertText = await formAlert.textContent()
step('téléphone illisible refusé par le serveur',
  /téléphone/i.test(alertText), alertText.trim())

// Commande valide
await p.getByLabel('téléphone').fill(PHONE)
await p.locator('button[type=submit]').click()
await p.waitForURL('**/suivi/**', { timeout: 15000 })
step('commande passée, redirection vers le suivi', p.url().includes('/suivi/'))

const body = await p.textContent('body')
step('numéro de commande lisible', /EB-\d{6}-\d{3}/.test(body),
  (body.match(/EB-\d{6}-\d{3}/) || [])[0])
// 75 + 15 = 90 l'unité × 2 = 180
step('total recalculé par le serveur : 180 MAD', body.includes('180 MAD'))
step('étape « Reçue » active', body.includes('Reçue'))

// §8 — le prénom est demandé une fois la commande passée.
step('le suivi demande le prénom', /comment on t’appelle/i.test(body))
await p.getByLabel('prénom').fill('Yasmine')
await p.locator('form button[type=submit]').click()
await p.waitForTimeout(2000)
step('prénom enregistré, la question disparaît',
  !/comment on t’appelle/i.test(await p.textContent('body')))

// Le panier est vidé après commande
await p.goto(BASE + '/panier', { waitUntil: 'networkidle' })
step('panier vidé après commande',
  (await p.locator('text=panier vide').count()) > 0)

console.log(errs.length ? '\nERREURS CONSOLE : ' + errs.join(' | ') : '\naucune erreur console')
await b.close()
