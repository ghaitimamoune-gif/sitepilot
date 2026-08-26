'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export type OtpResult = { ok: true } | { ok: false; error: string }

const NO_DB = 'La connexion n’est pas encore activée.'

/**
 * §8 — le téléphone est le seul moment où on demande une identification.
 *
 * Chaque SMS coûte de l'argent et chaque OTP perd des commandes : la session
 * dure un an (réglage « JWT expiry » et durée du refresh token, à régler dans
 * le projet Supabase), et on ne redemande un code qu'exceptionnellement.
 */
export async function requestOtp(phone: string): Promise<OtpResult> {
  const supabase = await createClient()
  if (!supabase) return { ok: false, error: NO_DB }

  const cleaned = phone.replace(/\s/g, '')
  if (!/^(\+?212|0)[5-7]\d{8}$/.test(cleaned)) {
    return { ok: false, error: 'Ce numéro ne ressemble pas à un mobile marocain.' }
  }

  // Supabase attend un E.164. La normalisation qui fait autorité reste celle
  // de la base ; celle-ci ne sert qu'à parler à l'API d'envoi.
  const e164 = cleaned.startsWith('+')
    ? cleaned
    : cleaned.startsWith('212')
      ? `+${cleaned}`
      : `+212${cleaned.replace(/^0/, '')}`

  const { error } = await supabase.auth.signInWithOtp({ phone: e164 })

  if (error) {
    return {
      ok: false,
      error:
        error.status === 429
          ? 'Trop de demandes. Attends une minute avant de réessayer.'
          : 'L’envoi du code a échoué. Réessaie dans un instant.',
    }
  }

  return { ok: true }
}

export async function verifyOtp(phone: string, code: string): Promise<OtpResult> {
  const supabase = await createClient()
  if (!supabase) return { ok: false, error: NO_DB }

  const cleaned = phone.replace(/\s/g, '')
  const e164 = cleaned.startsWith('+')
    ? cleaned
    : cleaned.startsWith('212')
      ? `+${cleaned}`
      : `+212${cleaned.replace(/^0/, '')}`

  const { error } = await supabase.auth.verifyOtp({
    phone: e164,
    token: code.replace(/\D/g, ''),
    type: 'sms',
  })

  if (error) {
    return { ok: false, error: 'Code incorrect ou expiré. Demande-en un nouveau.' }
  }

  // Rattache la session à la fiche client. Le numéro vient du jeton, pas du
  // navigateur : impossible de se rattacher à la fiche de quelqu'un d'autre.
  const { error: linkError } = await supabase.rpc('link_current_customer')
  if (linkError) {
    return { ok: false, error: linkError.message }
  }

  revalidatePath('/', 'layout')
  return { ok: true }
}

export async function signOutCustomer() {
  const supabase = await createClient()
  await supabase?.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/')
}
