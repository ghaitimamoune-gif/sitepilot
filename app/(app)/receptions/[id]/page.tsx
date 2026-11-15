import { notFound } from "next/navigation";
import { EcranReception } from "@/components/receptions/EcranReception";
import { Badge, EnTete } from "@/components/ui/primitives";
import { aLeDroit } from "@/lib/auth/droits";
import { exigerDroit } from "@/lib/auth/session";
import { dateLongue } from "@/lib/dates";
import { chargerMoteur } from "@/lib/services/moteur";
import { photosDe } from "@/lib/services/photos";
import { receptionVue } from "@/lib/services/receptions";
import { serialiser } from "@/lib/vues";

export default async function PageReception({ params }: { params: Promise<{ id: string }> }) {
  const s = await exigerDroit("receptions:lire");
  const { id } = await params;
  const vue = await receptionVue(Number(id));
  if (!vue) notFound();
  const [photos, { articles }] = await Promise.all([photosDe("reception", vue.reception.id), chargerMoteur()]);
  const catalogue = [...articles.values()]
    .filter((a) => a.statut !== "archive" && a.nature !== "preparation")
    .map((a) => ({ id: a.id, nom: a.nom, unite: a.uniteComptage }))
    .sort((x, y) => x.nom.localeCompare(y.nom, "fr"));
  const r = vue.reception;
  return (
    <>
      <EnTete
        titre={vue.fournisseur.nom}
        retour="/receptions"
        sousTitre={
          <>
            Réception n° {r.id} · {dateLongue(r.date)} · <Badge teinte={r.statut === "validee" ? "vert" : "orange"}>{r.statut === "validee" ? "validée" : "en cours"}</Badge>
            {r.commandeId ? ` · commande n° ${r.commandeId}` : r.achatDirect ? " · achat direct" : " · sans commande"}
            {r.parSuppleant && " · par suppléant"}
          </>
        }
      />
      <EcranReception vue={serialiser(vue)} photos={photos.map((p) => ({ id: p.id, priseLe: p.priseLe.toISOString() }))} catalogue={catalogue} peutEcrire={aLeDroit(s.poste.role, "receptions:ecrire")} />
    </>
  );
}
