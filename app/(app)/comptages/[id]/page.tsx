import { eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { droitComptageFamille } from "@/app/actions/comptages";
import { EcranComptage } from "@/components/comptages/EcranComptage";
import { Badge, EnTete } from "@/components/ui/primitives";
import { aLeDroit } from "@/lib/auth/droits";
import { exigerSession } from "@/lib/auth/session";
import { db, schema } from "@/lib/db";
import { dateLongue } from "@/lib/dates";
import { comptageAvecLignes } from "@/lib/services/comptages";
import { dernierModeConsommation } from "@/lib/services/consommation";
import { chargerMoteur } from "@/lib/services/moteur";
import { nombreDepuis } from "@/lib/services/parametres";

export default async function PageComptage({ params }: { params: Promise<{ id: string }> }) {
  const s = await exigerSession();
  const { id } = await params;
  const v = await comptageAvecLignes(Number(id));
  if (!v) notFound();
  const peutEcrire = await droitComptageFamille(s, v.comptage.familleId);
  const peutLire = peutEcrire || aLeDroit(s.poste.role, "comptage_cuisine:lire") || aLeDroit(s.poste.role, "comptage_reserve:lire");
  if (!peutLire) redirect("/refuse?droit=comptage");
  if (!peutEcrire && v.comptage.statut === "en_cours") redirect("/comptages");
  const [[famille], { articles, parametres }, mode, [personne]] = await Promise.all([
    db.select().from(schema.familles).where(eq(schema.familles.id, v.comptage.familleId)),
    chargerMoteur(),
    dernierModeConsommation(),
    db.select().from(schema.personnes).where(eq(schema.personnes.id, v.comptage.personneId)),
  ]);
  const seuil = mode === "import" ? nombreDepuis(parametres, "seuil_ecart_stock_structurant") : nombreDepuis(parametres, "seuil_ecart_stock_estime");
  const catalogue = [...articles.values()]
    .filter((a) => a.statut !== "archive" && (!v.comptage.fermeture || a.critique))
    .map((a) => ({ id: a.id, nom: a.nom, unite: a.uniteComptage }))
    .sort((x, y) => x.nom.localeCompare(y.nom, "fr"));
  return (
    <>
      <EnTete
        titre={`${famille?.nom ?? "Comptage"}${v.comptage.fermeture ? " — fermeture" : ""}`}
        retour="/comptages"
        sousTitre={
          <>
            {dateLongue(v.comptage.date)} · {personne?.prenom ?? "—"} · <Badge teinte={v.comptage.statut === "valide" ? "vert" : "orange"}>{v.comptage.statut === "valide" ? "validé" : "en cours"}</Badge>
          </>
        }
      />
      <EcranComptage comptageId={v.comptage.id} lignes={v.lignes} valide={v.comptage.statut === "valide"} catalogue={catalogue} seuilPct={seuil} modeConsommation={(v.comptage.modeConsommation as "import" | "estime" | null) ?? mode} />
    </>
  );
}
