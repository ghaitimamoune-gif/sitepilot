import Link from "next/link";
import { Badge, Carte, EnTete, Ligne, Vide } from "@/components/ui/primitives";
import { aLeDroit } from "@/lib/auth/droits";
import { exigerDroit } from "@/lib/auth/session";
import { dateCourte, dateLongue, instantCourt, journeeExploitation } from "@/lib/dates";
import { historiqueReceptions, receptionsDuJour } from "@/lib/services/receptions";

export default async function PageReceptions() {
  const s = await exigerDroit("receptions:lire");
  const peutEcrire = aLeDroit(s.poste.role, "receptions:ecrire");
  const journee = journeeExploitation();
  const [duJour, historique] = await Promise.all([receptionsDuJour(journee), historiqueReceptions(30)]);
  const anciennes = historique.filter((h) => h.r.date !== journee);
  return (
    <>
      <EnTete
        titre="Réceptions"
        sousTitre={`${dateLongue(journee)} · une réception par livraison`}
        action={peutEcrire ? <Link href="/receptions/nouvelle" className="btn-brand btn-sm">Nouvelle réception</Link> : undefined}
      />
      <div className="flex flex-col gap-4">
        <Carte titre="Aujourd'hui">
          {duJour.length === 0 ? (
            <Vide>Aucune réception saisie aujourd&apos;hui.</Vide>
          ) : (
            <ul className="divide-rows">
              {duJour.map((h) => (
                <li key={h.r.id}>
                  <Ligne
                    href={`/receptions/${h.r.id}`}
                    gauche={
                      <>
                        <span className="font-medium">{h.fournisseur}</span>
                        <span className="block text-xs text-muted">
                          {h.prenom ?? "—"} · {instantCourt(h.r.creeLe)}
                          {h.r.parSuppleant ? " · par suppléant" : ""}
                          {h.r.achatDirect ? " · achat direct" : ""}
                          {h.r.rectifieId ? ` · rectifie n° ${h.r.rectifieId}` : ""}
                        </span>
                      </>
                    }
                    droite={<Badge teinte={h.r.statut === "validee" ? "vert" : "orange"}>{h.r.statut === "validee" ? "validée" : "en cours"}</Badge>}
                  />
                </li>
              ))}
            </ul>
          )}
        </Carte>
        {anciennes.length > 0 && (
          <Carte titre="Historique">
            <ul className="divide-rows">
              {anciennes.map((h) => (
                <li key={h.r.id}>
                  <Ligne href={`/receptions/${h.r.id}`} gauche={<span>{h.fournisseur} <span className="text-xs text-muted">· {dateCourte(h.r.date)} · {h.prenom ?? "—"}</span></span>} droite={<Badge teinte={h.r.statut === "validee" ? "vert" : "orange"}>{h.r.statut === "validee" ? "validée" : "en cours"}</Badge>} />
                </li>
              ))}
            </ul>
          </Carte>
        )}
      </div>
    </>
  );
}
