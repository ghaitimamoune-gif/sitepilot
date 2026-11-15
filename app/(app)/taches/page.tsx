import Link from "next/link";
import { CarteTache } from "@/components/taches/CarteTache";
import { EnTete, Vide } from "@/components/ui/primitives";
import { aLeDroit } from "@/lib/auth/droits";
import { exigerSession } from "@/lib/auth/session";
import { dateLongue, journeeExploitation } from "@/lib/dates";
import { genererTachesDuJour, tachesDuPoste } from "@/lib/services/taches";

export default async function PageTaches() {
  const s = await exigerSession();
  const journee = journeeExploitation();
  await genererTachesDuJour(journee);
  const taches = await tachesDuPoste(s.poste.id, journee);
  const restantes = taches.filter((t) => ["a_faire", "a_refaire", "en_retard", "bloquee"].includes(t.statut));
  const faites = taches.filter((t) => !restantes.includes(t));
  return (
    <>
      <EnTete
        titre="Mes tâches"
        sousTitre={`${dateLongue(journee)} · ${restantes.length} restante${restantes.length > 1 ? "s" : ""}`}
        action={aLeDroit(s.poste.role, "taches:creer") ? <Link href="/taches/nouvelle" className="btn-ghost btn-sm">+ Tâche</Link> : undefined}
      />
      <div className="flex flex-col gap-2">
        {restantes.length === 0 && <Vide>Rien à faire pour le moment.</Vide>}
        {restantes.map((t) => (
          <CarteTache key={t.id} t={t} />
        ))}
        {faites.length > 0 && (
          <>
            <h2 className="mt-4 text-base text-muted">Terminées</h2>
            {faites.map((t) => (
              <CarteTache key={t.id} t={t} />
            ))}
          </>
        )}
      </div>
    </>
  );
}
