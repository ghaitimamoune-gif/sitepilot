'use client'

import { useActionState } from 'react'
import { useRouter } from 'next/navigation'
import { importTickets } from '@/app/actions/glovo'
import { Button } from '@/components/ui/Button'
import { Eyebrow } from '@/components/ui/Eyebrow'

/**
 * §11.3 — import de l'export de ventes.
 *
 * Coller le contenu plutôt que téléverser un fichier : ça marche depuis
 * l'iPad de la caisse, sans gérer d'upload ni de stockage, et le responsable
 * voit ce qu'il envoie.
 */
export function ImportTicketsForm() {
  const router = useRouter()
  const [state, action, pending] = useActionState(
    async (prev: unknown, formData: FormData) => {
      const result = await importTickets(prev, formData)
      if (result.ok) router.refresh()
      return result
    },
    null,
  )

  return (
    <form action={action} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5">
        <Eyebrow className="text-eb-grey">export des ventes</Eyebrow>
        <textarea
          name="csv"
          required
          rows={8}
          placeholder={'A-1042;74,50;24/08/2026\nA-1043;60;24/08/2026'}
          className="w-full border border-eb-line p-3 text-body-s"
        />
        <span className="text-body-s text-eb-grey">
          Trois colonnes : référence, montant, date. Séparateur ; , ou tabulation.
          Les dates au format JJ/MM/AAAA ou AAAA-MM-JJ. L’en-tête est ignoré,
          et réimporter le même fichier ne double rien.
        </span>
      </label>

      {state && (
        <p
          role="alert"
          className={
            state.ok
              ? 'bg-eb-black px-4 py-3 text-body text-eb-white'
              : 'bg-eb-orange px-4 py-3 text-body text-eb-white'
          }
        >
          {state.ok
            ? `${state.inserted} tickets importés, ${state.skipped} ignorés. ` +
              `Rapprochement : ${state.matched} créditées, ${state.rejected} rejetées.`
            : state.error}
        </p>
      )}

      <Button type="submit" loading={pending} className="w-fit">
        Importer et rapprocher
      </Button>
    </form>
  )
}
