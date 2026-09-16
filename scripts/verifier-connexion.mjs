#!/usr/bin/env node
/**
 * Diagnostic de connexion — SitePilot
 *
 * Interroge directement l'API d'authentification Supabase, sans passer par
 * l'application. Permet de savoir si le problème vient du compte ou du code,
 * et fonctionne même si le site déployé est en panne.
 *
 *   node scripts/verifier-connexion.mjs
 *   node scripts/verifier-connexion.mjs vous@exemple.com
 *
 * Le mot de passe est saisi masqué, n'est jamais affiché, jamais écrit sur le
 * disque, et n'est transmis qu'à votre propre projet Supabase.
 */

import { readFileSync, existsSync } from 'node:fs'
import { createInterface } from 'node:readline'
import process from 'node:process'

const C = {
  reset: '\x1b[0m', gras: '\x1b[1m', gris: '\x1b[90m',
  rouge: '\x1b[31m', vert: '\x1b[32m', orange: '\x1b[33m', bleu: '\x1b[36m',
}

function titre(t) { console.log(`\n${C.gras}${t}${C.reset}`) }
function ok(t) { console.log(`${C.vert}✓${C.reset} ${t}`) }
function ko(t) { console.log(`${C.rouge}✗${C.reset} ${t}`) }
function info(t) { console.log(`${C.gris}  ${t}${C.reset}`) }

/** Lit les variables depuis .env.local / .env sans dépendance externe. */
function chargerEnv() {
  for (const fichier of ['.env.local', '.env']) {
    if (!existsSync(fichier)) continue
    for (const ligne of readFileSync(fichier, 'utf8').split('\n')) {
      const m = ligne.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
      if (!m) continue
      const valeur = m[2].replace(/^["']|["']$/g, '').trim()
      if (valeur && !process.env[m[1]]) process.env[m[1]] = valeur
    }
  }
}

function demander(question, masque = false) {
  return new Promise(resolve => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true })
    if (masque) {
      // Neutralise l'affichage des caractères saisis.
      const ecrire = rl._writeToOutput?.bind(rl)
      rl._writeToOutput = function (s) {
        if (s.includes(question)) return ecrire ? ecrire(s) : process.stdout.write(s)
        process.stdout.write('')
      }
    }
    rl.question(question, reponse => {
      if (masque) process.stdout.write('\n')
      rl.close()
      resolve(reponse.trim())
    })
  })
}

/** Traduit la réponse de Supabase en diagnostic exploitable. */
function interpreter(statut, corps) {
  const code = corps.error_code || corps.error || ''
  const msg = (corps.msg || corps.error_description || corps.message || '').toLowerCase()

  if (code === 'email_not_confirmed' || msg.includes('email not confirmed')) {
    return {
      verdict: 'IDENTIFIANTS CORRECTS — adresse e-mail non confirmée',
      couleur: C.orange,
      explication:
        "Votre mot de passe est bon. Supabase bloque la connexion parce que l'adresse\n" +
        "  n'a jamais été confirmée. C'est ce cas que l'application affichait à tort\n" +
        "  comme « Email ou mot de passe incorrect ».",
      remede: [
        'Ouvrez le lien de confirmation reçu par e-mail (vérifiez les indésirables), OU',
        'Supabase → Authentication → Users → votre compte → Send confirmation email, OU',
        "exécutez la section 2 de supabase/recuperation_acces.sql pour confirmer l'adresse à la main, OU",
        'désactivez la contrainte : Authentication → Sign In / Providers → Email → décocher « Confirm email »',
      ],
    }
  }
  if (code === 'invalid_credentials' || code === 'invalid_grant' || msg.includes('invalid login credentials')) {
    return {
      verdict: 'IDENTIFIANTS REFUSÉS',
      couleur: C.rouge,
      explication:
        "Supabase ne reconnaît pas ce couple adresse / mot de passe. Soit le mot de\n" +
        "  passe est faux, soit aucun compte n'existe sous cette adresse sur CE projet\n" +
        "  Supabase (vérifiez que l'URL ci-dessus est bien celle utilisée en production).",
      remede: [
        'Supabase → Authentication → Users : le compte figure-t-il dans la liste ?',
        "Si oui : menu « … » → Reset password pour définir un nouveau mot de passe.",
        "Si non : créez le compte via la page d'inscription de l'application.",
      ],
    }
  }
  if (code === 'over_request_rate_limit' || statut === 429) {
    return {
      verdict: 'TROP DE TENTATIVES',
      couleur: C.orange,
      explication: "Supabase a temporairement bloqué les tentatives depuis cette adresse IP.",
      remede: ['Patientez une quinzaine de minutes, puis relancez ce diagnostic.'],
    }
  }
  if (code === 'user_banned') {
    return {
      verdict: 'COMPTE SUSPENDU',
      couleur: C.rouge,
      explication: 'Ce compte a été banni côté Supabase.',
      remede: ['Supabase → Authentication → Users → lever la suspension.'],
    }
  }
  return {
    verdict: `RÉPONSE INATTENDUE (HTTP ${statut})`,
    couleur: C.rouge,
    explication: `Code renvoyé : ${code || '(aucun)'} — ${corps.msg || corps.error_description || '(pas de message)'}`,
    remede: ['Transmettez ce bloc tel quel pour analyse.'],
  }
}

async function main() {
  console.log(`${C.bleu}${C.gras}\n  SitePilot — diagnostic de connexion${C.reset}`)
  console.log(`${C.gris}  Interroge Supabase directement, sans passer par l'application.${C.reset}`)

  chargerEnv()
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const cle = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  titre('1. Configuration')
  if (!url || !cle) {
    ko('Variables Supabase introuvables.')
    info('Attendu dans .env.local (ou dans l\'environnement) :')
    info('  NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co')
    info('  NEXT_PUBLIC_SUPABASE_ANON_KEY=...')
    info('Ces valeurs se trouvent dans Supabase → Settings → API,')
    info('ou dans Netlify → Site settings → Environment variables.')
    process.exit(1)
  }
  ok(`Projet Supabase : ${url}`)
  info(`Clé anonyme : ${cle.slice(0, 12)}…${cle.slice(-4)}`)

  titre('2. Le projet Supabase répond-il ?')
  try {
    const r = await fetch(`${url}/auth/v1/health`, { headers: { apikey: cle } })
    if (r.ok) ok('Service d\'authentification joignable.')
    else { ko(`Le service répond HTTP ${r.status}.`); info('Projet suspendu, ou URL/clé incorrecte.') }
  } catch (e) {
    ko(`Projet injoignable : ${e.message}`)
    info('Projet Supabase probablement en veille — réactivez-le depuis le tableau de bord.')
    process.exit(1)
  }

  titre('3. Vos identifiants')
  const email = process.argv[2] || await demander('   Adresse e-mail : ')
  const motDePasse = await demander('   Mot de passe (saisie masquée) : ', true)
  if (!email || !motDePasse) { ko('Adresse et mot de passe requis.'); process.exit(1) }

  const reponse = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: cle, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: motDePasse }),
  })
  const corps = await reponse.json().catch(() => ({}))

  titre('4. Verdict')
  if (reponse.ok && corps.access_token) {
    console.log(`${C.vert}${C.gras}   CONNEXION RÉUSSIE${C.reset}`)
    info('Vos identifiants sont valides côté Supabase.')
    info("Si l'application les refuse malgré tout, le problème est dans le code")
    info('déployé — vérifiez que la version corrigée est bien en ligne.')
    if (corps.user) {
      info(`Compte : ${corps.user.email}  (id ${corps.user.id})`)
      info(`Adresse confirmée le : ${corps.user.email_confirmed_at || 'jamais'}`)
    }
    return
  }

  const d = interpreter(reponse.status, corps)
  console.log(`${d.couleur}${C.gras}   ${d.verdict}${C.reset}`)
  console.log(`\n  ${d.explication}`)
  console.log(`\n${C.gras}  Que faire :${C.reset}`)
  d.remede.forEach((r, i) => console.log(`   ${i + 1}. ${r}`))
  console.log()
}

main().catch(e => { console.error(`\n${C.rouge}Erreur inattendue :${C.reset}`, e.message); process.exit(1) })
