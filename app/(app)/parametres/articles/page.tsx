import Link from "next/link";
import { Badge, Carte, EnTete, Ligne } from "@/components/ui/primitives";
import { aLeDroit } from "@/lib/auth/droits";
import { exigerDroit } from "@/lib/auth/session";
import { chargerMoteur } from "@/lib/services/moteur";

const NATURE: Record<string, string> = { matiere_premiere: "matière première", preparation: "préparation", emballage: "emballage", consommable: "consommable", tenue: "tenue", materiel: "matériel" };

export default async function PageArticles({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const s = await exigerDroit("parametres:lire");
  const { q } = await searchParams;
  const { articles } = await chargerMoteur();
  const recherche = (q ?? "").toLowerCase().trim();
  const liste = [...articles.values()]
    .filter((a) => (recherche ? a.nom.toLowerCase().includes(recherche) : true))
    .sort((x, y) => Number(x.statut === "archive") - Number(y.statut === "archive") || (x.familleNom ?? "").localeCompare(y.familleNom ?? "", "fr") || x.nom.localeCompare(y.nom, "fr"));
  const aVerifier = liste.filter((a) => a.statut === "a_verifier" || a.aConfirmer);
  return (
    <>
      <EnTete titre="Articles" retour="/parametres" sousTitre={`${liste.length} articles · ${aVerifier.length} à vérifier ou à confirmer`} action={aLeDroit(s.poste.role, "parametres:ecrire") ? <Link href="/parametres/articles/nouveau" className="btn-brand btn-sm">+ Article</Link> : undefined} />
      <form method="get" className="mb-3 flex gap-2">
        <input name="q" defaultValue={q ?? ""} className="input flex-1" placeholder="Rechercher" />
        <button className="btn-ghost" type="submit">OK</button>
      </form>
      <Carte className="divide-rows p-0 px-3">
        {liste.map((a) => (
          <Ligne
            key={a.id}
            href={`/parametres/articles/${a.id}`}
            gauche={
              <>
                <span className={`font-medium ${a.statut === "archive" ? "text-muted line-through" : ""}`}>
                  {a.nom} {a.statut === "a_verifier" && <Badge teinte="orange">à vérifier</Badge>} {a.aConfirmer && a.statut !== "a_verifier" && <Badge teinte="orange">à confirmer</Badge>} {a.structurant && <Badge teinte="brand">structurant</Badge>}
                </span>
                <span className="block text-xs text-muted">
                  {NATURE[a.nature]} · {a.familleNom ?? "—"} · {a.uniteComptage}
                  {a.dlcJours !== null ? ` · DLC ${a.dlcJours} j` : ""}
                  {a.famillePerteNom ? ` · perte ${a.famillePerteNom}` : ""}
                </span>
              </>
            }
            droite={<span className="text-muted">›</span>}
          />
        ))}
      </Carte>
    </>
  );
}
