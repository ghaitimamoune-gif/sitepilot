/**
 * Parcours fidélité : connexion par OTP, écran fidélité, compte, et
 * checkout préremplí par la session.
 *
 * Le bouchon GoTrue du proxy accepte n'importe quel numéro avec le code
 * 123456 ; le reste — rattachement de la fiche, RLS, points — est réel.
 */
import { chromium } from 'playwright'

const BASE = process.env.BASE ?? 'http://127.0.0.1:3230'
const PHONE = process.env.PHONE ?? '06 12 34 56 78'

const b = await chromium.launch()
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
const p = await ctx.newPage()
const errs = []
p.on('pageerror', (e) => errs.push(String(e)))
p.on('console', (m) => m.type() === 'error' && errs.push(m.text()))

const step = (n, ok, extra = '') =>
  console.log(`${ok ? '  OK  ' : 'ÉCHEC '} ${n}${extra ? ' → ' + extra : ''}`)

// --------------------------------------------------------------- onglets
await p.goto(BASE + '/', { waitUntil: 'networkidle' })
step('trois onglets, pas plus',
  (await p.locator('nav[aria-label="Navigation principale"] a').count()) === 3)

// Non connecté, l'onglet Fidélité mène à la connexion.
await p.locator('nav[aria-label="Navigation principale"] a', { hasText: 'Fidélité' }).click()
await p.waitForURL('**/connexion**')
step('sans session, Fidélité renvoie à la connexion', p.url().includes('/connexion'))

// -------------------------------------------------------------- mauvais code
await p.getByLabel('téléphone').fill(PHONE)
await p.locator('button[type=submit]').click()
await p.getByLabel('code reçu par SMS').waitFor({ timeout: 15000 })
step('le formulaire passe à l’étape du code', true)

await p.getByLabel('code reçu par SMS').fill('000000')
await p.locator('button[type=submit]').click()
await p.locator('form [role=alert]').waitFor({ timeout: 15000 })
step('code faux refusé',
  /incorrect|expiré/i.test(await p.locator('form [role=alert]').textContent()))

// ------------------------------------------------------------------ bon code
await p.getByLabel('code reçu par SMS').fill('123456')
await p.locator('button[type=submit]').click()
await p.waitForURL('**/fidelite', { timeout: 20000 })
step('connexion réussie, redirection vers Fidélité', p.url().endsWith('/fidelite'))

let body = await p.textContent('body')
step('la carte de fidélité affiche le solde', /mon solde/i.test(body))
step('le numéro est affiché normalisé', body.includes('06 12 34 56 78'))
step('la règle est rappelée en une phrase', /1 dirham dépensé = 1 point/.test(body))
await p.screenshot({ path: 'e2e/.bin/shots/fidelite.png', fullPage: true })

// ------------------------------------------------------------------- compte
await p.locator('nav[aria-label="Navigation principale"] a', { hasText: 'Compte' }).click()
await p.waitForURL('**/compte')

await p.getByLabel('prénom').fill('Yasmine')
await p.locator('form:has([name=first_name]) button[type=submit]').click()
await p.locator('form:has([name=first_name]) [role=alert]').waitFor({ timeout: 15000 })
step('profil enregistré',
  /enregistré/i.test(await p.locator('form:has([name=first_name]) [role=alert]').textContent()))

await p.getByLabel('nom de l’adresse').fill('Maison')
await p.getByLabel('adresse', { exact: true }).fill('12 rue des Écoles, Maârif')
await p.locator('form:has([name=street]) button[type=submit]').click()
await p.waitForTimeout(1500)
body = await p.textContent('body')
step('adresse enregistrée et marquée par défaut',
  body.includes('12 rue des Écoles') && /par défaut/i.test(body))
await p.screenshot({ path: 'e2e/.bin/shots/compte.png', fullPage: true })

// ------------------------------------------------ checkout prérempli
await p.goto(BASE + '/p/cheeseburger', { waitUntil: 'networkidle' })
await p.locator('button:has-text("Ajouter ·")').click()
await p.waitForURL('**/panier')
await p.locator('button:has-text("Commander ·")').click()
await p.waitForURL('**/commande')

body = await p.textContent('body')
step('le téléphone n’est plus à ressaisir', /tes points y sont/i.test(body))
step('le prénom n’est plus demandé au checkout',
  (await p.getByLabel('prénom').count()) === 0)
step('l’adresse enregistrée est proposée', body.includes('Maison'))
step('et préremplie',
  (await p.getByLabel('adresse de livraison').inputValue()).includes('12 rue des Écoles'))

await p.locator('button[type=submit]').click()
await p.waitForURL('**/suivi/**', { timeout: 20000 })
step('commande passée avec la session', p.url().includes('/suivi/'))
step('le prénom déjà connu n’est pas redemandé',
  !/comment on t’appelle/i.test(await p.textContent('body')))

// ----------------------------------------------- les points sont crédités
await p.goto(BASE + '/fidelite', { waitUntil: 'networkidle' })
body = await p.textContent('body')
step('l’historique liste la commande', /Commande/.test(body))

console.log(errs.length ? '\nERREURS CONSOLE : ' + errs.join(' | ') : '\naucune erreur console')
await b.close()
