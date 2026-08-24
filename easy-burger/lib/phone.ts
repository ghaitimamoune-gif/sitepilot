/**
 * Affichage et recherche de numéros.
 *
 * La normalisation qui fait autorité est en base (`public.normalize_phone`,
 * appliquée par trigger avant la contrainte d'unicité). Ces fonctions-ci ne
 * servent qu'à l'affichage et à la recherche : elles ne décident jamais de
 * l'identité d'un client.
 */

/** +212612345678 → « 06 12 34 56 78 » */
export function formatPhone(e164: string): string {
  const m = /^\+212(\d{9})$/.exec(e164)
  if (!m) return e164

  const national = `0${m[1]}`
  return national.replace(/(\d{2})(?=\d)/g, '$1 ').trim()
}

/**
 * Fragment à chercher en base, quel que soit le format saisi.
 * « 06 12 34 56 78 », « +212612345678 » et « 612345678 » donnent tous
 * « 612345678 ».
 */
export function phoneSearchFragment(input: string): string {
  const digits = input.replace(/\D/g, '')
  return digits.slice(-9)
}
