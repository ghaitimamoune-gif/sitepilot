'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export type ProfileResult = { ok: true; message: string } | { ok: false; error: string }

const NO_DB = 'La base n’est pas branchée.'

export async function updateProfile(
  _prev: unknown,
  formData: FormData,
): Promise<ProfileResult> {
  const supabase = await createClient()
  if (!supabase) return { ok: false, error: NO_DB }

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Reconnecte-toi pour modifier ton profil.' }

  const firstName = String(formData.get('first_name') ?? '').trim()
  const birthdate = String(formData.get('birthdate') ?? '').trim()
  const consent = formData.get('marketing_consent') === 'on'

  if (firstName === '') {
    return { ok: false, error: 'Indique un prénom.' }
  }

  const patch: Record<string, unknown> = {
    first_name: firstName,
    marketing_consent: consent,
    // §13 : le consentement marketing est stocké avec sa date, séparément du
    // consentement transactionnel.
    consent_at: consent ? new Date().toISOString() : null,
  }
  if (birthdate) patch.birthdate = birthdate

  const { error } = await supabase
    .from('customers')
    .update(patch)
    .eq('auth_user_id', user.id)

  if (error) {
    // §6.3 : la date de naissance n'est modifiable qu'une fois — le refus
    // vient d'un trigger, avec son message.
    return { ok: false, error: error.message }
  }

  revalidatePath('/compte')
  return { ok: true, message: 'Profil enregistré' }
}

export async function addAddress(
  _prev: unknown,
  formData: FormData,
): Promise<ProfileResult> {
  const supabase = await createClient()
  if (!supabase) return { ok: false, error: NO_DB }

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Reconnecte-toi pour ajouter une adresse.' }

  const { data: customer } = await supabase
    .from('customers')
    .select('id')
    .eq('auth_user_id', user.id)
    .maybeSingle()

  if (!customer) return { ok: false, error: 'Fiche client introuvable.' }

  const street = String(formData.get('street') ?? '').trim()
  if (street === '') return { ok: false, error: 'Indique une adresse.' }

  const { count } = await supabase
    .from('addresses')
    .select('id', { count: 'exact', head: true })

  const { error } = await supabase.from('addresses').insert({
    customer_id: (customer as { id: string }).id,
    label: String(formData.get('label') ?? '').trim() || null,
    street,
    details: String(formData.get('details') ?? '').trim() || null,
    // La première adresse enregistrée devient celle par défaut.
    is_default: (count ?? 0) === 0,
  })

  if (error) return { ok: false, error: error.message }

  revalidatePath('/compte')
  return { ok: true, message: 'Adresse enregistrée' }
}

export async function deleteAddress(id: string): Promise<ProfileResult> {
  const supabase = await createClient()
  if (!supabase) return { ok: false, error: NO_DB }

  const { error } = await supabase.from('addresses').delete().eq('id', id)
  if (error) return { ok: false, error: error.message }

  revalidatePath('/compte')
  return { ok: true, message: 'Adresse supprimée' }
}

/** §13 — suppression de compte accessible depuis l'app. */
export async function deleteAccount(): Promise<void> {
  const supabase = await createClient()
  if (!supabase) return

  const { error } = await supabase.rpc('delete_my_account')
  if (!error) await supabase.auth.signOut()

  revalidatePath('/', 'layout')
  redirect('/')
}
