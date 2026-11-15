import { actionDeclarerPerte } from "@/app/actions/stocks";
import { FormulairePerte } from "@/components/pertes/FormulairePerte";
import { Photos } from "@/components/ui/Photos";
import { Carte, EnTete, Message, Vide } from "@/components/ui/primitives";
import { exigerDroit } from "@/lib/auth/session";
import { dateLongue, instantCourt, journeeExploitation } from "@/lib/dates";
import { fmtDH, fmtNombre } from "@/lib/format";
import { chargerMoteur } from "@/lib/services/moteur";
import { LIBELLE_MOTIF, pertesEntre, totalPertesDuJour } from "@/lib/services/pertes";
import { photosDe } from "@/lib/services/photos";

export default async function PagePertes({ searchParams }: { searchParams: Promise<{ declaree?: string }> }) {
  await exigerDroit("pertes:declarer");
  const { declaree } = await searchParams;
  const journee = journeeExploitation();
  const [{ articles }, pertes, total] = await Promise.all([chargerMoteur(), pertesEntre(journee, journee), totalPertesDuJour(journee)]);
  const liste = [...articles.values()]
    .filter((a) => a.statut !== "archive")
    .map((a) => ({ id: a.id, nom: a.nom, unite: a.uniteComptage }))
    .sort((x, y) => x.nom.localeCompare(y.nom, "fr"));
  const derniere = declaree ? pertes.find((p) => p.p.id === Number(declaree)) : null;
  const photosDerniere = derniere ? await photosDe("perte", derniere.p.id) : [];
  return (
    <>
      <EnTete titre="Pertes" sousTitre={`${dateLongue(journee)} · ${fmtDH(total)} déclarés`} />
      <div className="flex flex-col gap-4">
        {derniere && (
          <Carte titre="Perte enregistrée">
            <Message type="succes">
              {derniere.article} : {fmtNombre(Number(derniere.p.quantite), 2)} {derniere.unite} — {LIBELLE_MOTIF[derniere.p.motif]}. Sortie du stock, ne comptera pas comme écart.
            </Message>
            <div className="mt-3">
              <p className="label">Photo (facultative)</p>
              <Photos objetType="perte" objetId={derniere.p.id} initiales={photosDerniere.map((p) => ({ id: p.id, priseLe: p.priseLe.toISOString() }))} maximum={3} />
            </div>
          </Carte>
        )}
        <FormulairePerte action={actionDeclarerPerte} articles={liste} motifs={Object.entries(LIBELLE_MOTIF)} />
        <Carte titre="Pertes du jour">
          {pertes.length === 0 ? (
            <Vide>Aucune perte déclarée aujourd&apos;hui.</Vide>
          ) : (
            <ul className="divide-rows text-sm">
              {pertes.map((p) => (
                <li key={p.p.id} className="flex items-center justify-between gap-2 py-1.5">
                  <span className="min-w-0">
                    <span className="font-medium">{p.article}</span>
                    <span className="block text-xs text-muted">
                      {LIBELLE_MOTIF[p.p.motif]} · {p.prenom ?? "—"} · {instantCourt(p.p.creeLe)}
                      {p.p.commentaire ? ` · ${p.p.commentaire}` : ""}
                    </span>
                  </span>
                  <span className="shrink-0 text-right tabular-nums">
                    {fmtNombre(Number(p.p.quantite), 2)} {p.unite}
                    {p.p.valeur !== null && <span className="block text-xs text-muted">{fmtDH(Number(p.p.valeur))}</span>}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Carte>
      </div>
    </>
  );
}
