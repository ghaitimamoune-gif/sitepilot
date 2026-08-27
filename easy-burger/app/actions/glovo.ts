'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { parseMADToCents } from '@/lib/money'

const NO_DB = 'La base n’est pas branchée.'

export type ClaimResult =
  | { ok: true; points: number; phone: string; newBalance: number; created: boolean }
  | { ok: false; error: string }

/**
 * §6.4c — le sticker sur le sac Glovo.
 *
 * Appelable sans compte : le sticker est physique, il est dans le sac du
 * client. C'est la machine à convertir les clients de la marketplace, elle
 * ne doit demander qu'un numéro.
 */
export async function claimGlovoCode(
  _prev: unknown,
  formData: FormData,
): Promise<ClaimResult> {
  const supabase = await createClient()
  if (!supabase) return { ok: false, error: NO_DB }

  const code = String(formData.get('code') ?? '').trim()
  const phone = String(formData.get('phone') ?? '').trim()

  if (code === '') return { ok: false, error: 'Recopie le code du sticker.' }

  const { data, error } = await supabase.rpc('claim_glovo_code', {
    p_code: code,
    p_phone: phone,
  })
  if (error) return { ok: false, error: error.message }

  const r = data as {
    points: number
    phone: string
    new_balance: number
    customer_created: boolean
  }

  return {
    ok: true,
    points: r.points,
    phone: r.phone,
    newBalance: r.new_balance,
    created: r.customer_created,
  }
}

export type TicketClaimResult =
  | { ok: true; ticketRef: string }
  | { ok: false; error: string }

/** §11.3 — le filet pour le client qui a oublié de donner son numéro. */
export async function submitTicketClaim(
  _prev: unknown,
  formData: FormData,
): Promise<TicketClaimResult> {
  const supabase = await createClient()
  if (!supabase) return { ok: false, error: NO_DB }

  const amountCents = parseMADToCents(String(formData.get('amount') ?? ''))
  if (amountCents === null) {
    return { ok: false, error: 'Le montant ne contient que des chiffres. Exemple : 74,50' }
  }

  const { data, error } = await supabase.rpc('submit_pos_claim', {
    p_ticket_ref: String(formData.get('ticket_ref') ?? ''),
    p_amount_cents: amountCents,
    p_ticket_date: String(formData.get('ticket_date') ?? ''),
  })
  if (error) return { ok: false, error: error.message }

  revalidatePath('/compte')
  return { ok: true, ticketRef: (data as { ticket_ref: string }).ticket_ref }
}

export type GenerateResult =
  | { ok: true; codes: string[] }
  | { ok: false; error: string }

/** §10 — génération de lots depuis le back-office. */
export async function generateClaimCodes(
  _prev: unknown,
  formData: FormData,
): Promise<GenerateResult> {
  const supabase = await createClient()
  if (!supabase) return { ok: false, error: NO_DB }

  const { data, error } = await supabase.rpc('generate_claim_codes', {
    p_batch: String(formData.get('batch') ?? '').trim(),
    p_count: Number(formData.get('count') ?? 0),
    p_points: Number(formData.get('points') ?? 0),
  })
  if (error) return { ok: false, error: error.message }

  revalidatePath('/admin/codes')
  return { ok: true, codes: (data as string[]) ?? [] }
}

export type ImportResult =
  | { ok: true; inserted: number; skipped: number; matched: number; rejected: number }
  | { ok: false; error: string }

/**
 * §11.3 — import de l'export de ventes, puis rapprochement.
 *
 * Le CSV est analysé ici plutôt qu'en base : c'est le seul endroit où la
 * forme du fichier de Lacaisse a de l'importance, et elle changera.
 */
export async function importTickets(
  _prev: unknown,
  formData: FormData,
): Promise<ImportResult> {
  const supabase = await createClient()
  if (!supabase) return { ok: false, error: NO_DB }

  const raw = String(formData.get('csv') ?? '').trim()
  if (raw === '') return { ok: false, error: 'Colle le contenu du fichier de ventes.' }

  const rows: { ref: string; amount_cents: number; date: string }[] = []
  for (const line of raw.split(/\r?\n/)) {
    const cells = line.split(/[;,\t]/).map((c) => c.trim().replace(/^"|"$/g, ''))
    if (cells.length < 3) continue

    const [ref, amount, date] = cells
    const cents = parseMADToCents(amount)
    const parsed = parseDate(date)
    // La première ligne d'un export est un en-tête : elle ne produit ni
    // montant ni date valides, donc elle tombe d'elle-même.
    if (!ref || cents === null || !parsed) continue

    rows.push({ ref, amount_cents: cents, date: parsed })
  }

  if (rows.length === 0) {
    return {
      ok: false,
      error:
        'Aucune ligne exploitable. Attendu : référence, montant, date — séparés par ; ou ,',
    }
  }

  const { data, error } = await supabase.rpc('import_pos_tickets', { p_rows: rows })
  if (error) return { ok: false, error: error.message }

  const imported = data as { inserted: number; skipped: number }

  const { data: rec, error: recError } = await supabase.rpc('reconcile_pos_claims')
  if (recError) return { ok: false, error: recError.message }

  const reconciled = rec as { matched: number; rejected: number }

  revalidatePath('/admin/tickets')
  return { ok: true, ...imported, ...reconciled }
}

/** Accepte JJ/MM/AAAA et AAAA-MM-JJ, les deux formes qu'on croise en export. */
function parseDate(input: string): string | null {
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(input)
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`

  const fr = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/.exec(input)
  if (fr) {
    return `${fr[3]}-${fr[2].padStart(2, '0')}-${fr[1].padStart(2, '0')}`
  }
  return null
}
