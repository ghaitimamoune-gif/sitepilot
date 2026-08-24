/**
 * Argent — §7 : tous les montants sont des ENTIERS de centimes.
 * Aucun flottant ne touche un montant, ni en base, ni en mémoire.
 *
 * Le dirham marocain a 2 décimales, mais la carte Easy Burger est en
 * dirhams entiers. On formate donc sans décimales quand il n'y en a pas.
 */

export const CURRENCY = 'MAD'

/** 6000 → « 60 MAD » · 6050 → « 60,50 MAD » */
export function formatMAD(cents: number, opts: { suffix?: boolean } = {}): string {
  const { suffix = true } = opts
  const negative = cents < 0
  const abs = Math.abs(Math.round(cents))
  const dirhams = Math.floor(abs / 100)
  const rest = abs % 100

  const body =
    rest === 0
      ? String(dirhams)
      : `${dirhams},${String(rest).padStart(2, '0')}`

  return `${negative ? '−' : ''}${body}${suffix ? ` ${CURRENCY}` : ''}`
}

/** Saisie caissier « 74,50 » ou « 74.5 » → 7450. `null` si illisible. */
export function parseMADToCents(input: string): number | null {
  const cleaned = input.trim().replace(/\s/g, '').replace(',', '.')
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null
  return Math.round(parseFloat(cleaned) * 100)
}

/** Somme de centimes, garantie entière. */
export function sumCents(...values: number[]): number {
  return values.reduce((total, v) => total + Math.round(v), 0)
}
