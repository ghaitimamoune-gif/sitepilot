import Link from "next/link";
import { actionPrix } from "@/app/actions/parametres";
import { ChampNombre } from "@/components/ui/ChampNombre";
import { Formulaire } from "@/components/ui/Formulaire";
import { Badge, Carte, Champ, EnTete, Vide } from "@/components/ui/primitives";
import { aLeDroit } from "@/lib/auth/droits";
import { exigerDroit } from "@/lib/auth/session";
import { dateLocale, joursEntre } from "@/lib/dates";
import { fmtDH } from "@/lib/format";
import { chargerMoteur } from "@/lib/services/moteur";
import { chargerParametres, nombreDepuis } from "@/lib/services/parametres";
import { derniersPrix } from "@/lib/services/stock";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";

export default async function PagePrix({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const s = await exigerDroit("prix:lire");
  const peutEcrire = aLeDroit(s.poste.role, "prix:ecrire");
  const { q } = await searchParams;
  const [{ articles }, prixMap, p, liens] = await Promise.all([
    chargerMoteur(),
    derniersPrix(),
    chargerParametres(),
    db
      .select({ af: schema.articleFournisseurs, fournisseur: schema.fournisseurs.nom })
      .from(schema.articleFournisseurs)
      .innerJoin(schema.fournisseurs, eq(schema.fournisseurs.id, schema.articleFournisseurs.fournisseurId))
      .where(eq(schema.articleFournisseurs.actif, true)),
  ]);
  const reverif = nombreDepuis(p, "prix_a_reverifier_jours");
  const aujourdHui = dateLocale();
  const recherche = (q ?? "").toLowerCase().trim();
  const liste = [...articles.values()]
    .filter((a) => a.statut !== "archive" && a.nature !== "preparation")
    .filter((a) => (recherche ? a.nom.toLowerCase().includes(recherche) : true))
    .sort((x, y) => x.nom.localeCompare(y.nom, "fr"));
  return (
    <>
      <EnTete titre="Prix d'achat" sousTitre="Par article et par fournisseur, hors taxe, avec la date. Un prix de plus de 30 jours est « à revérifier »." />
      <form method="get" className="mb-3 flex gap-2">
        <input name="q" defaultValue={q ?? ""} className="input flex-1" placeholder="Rechercher un article" />
        <button className="btn-ghost" type="submit">OK</button>
      </form>
      <div className="flex flex-col gap-2">
        {liste.length === 0 && <Vide>Aucun article.</Vide>}
        {liste.map((a) => {
          const lp = prixMap.get(a.id) ?? [];
          const liensArticle = liens.filter((l) => l.af.articleId === a.id);
          return (
            <Carte key={a.id} className="p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold">
                  <Link href={`/stocks/${a.id}`}>{a.nom}</Link> {a.structurant && <Badge teinte="brand">structurant</Badge>}
                </span>
                <span className="text-xs text-muted">{a.uniteComptage}</span>
              </div>
              {liensArticle.length === 0 ? (
                <p className="mt-1 text-xs text-muted">Aucun fournisseur lié.</p>
              ) : (
                <ul className="mt-1 divide-rows text-sm">
                  {liensArticle.map((l) => {
                    const prix = lp.find((x) => x.articleFournisseurId === l.af.id);
                    const vieux = prix ? joursEntre(prix.date, aujourdHui) > reverif : false;
                    return (
                      <li key={l.af.id} className="py-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <span>
                            {l.fournisseur} <span className="text-xs text-muted">/ {l.af.uniteCommande}</span>
                          </span>
                          <span className="tabular-nums">
                            {prix ? (
                              <>
                                {fmtDH(prix.prixHt, 2)} HT <span className={`text-xs ${vieux ? "text-amber-700" : "text-muted"}`}>{prix.date}{vieux ? " · à revérifier" : ""}</span>
                              </>
                            ) : (
                              <span className="text-muted">inconnu</span>
                            )}
                          </span>
                        </div>
                        {peutEcrire && (
                          <details className="text-xs">
                            <summary className="cursor-pointer text-brand">nouveau prix</summary>
                            <Formulaire action={actionPrix} bouton="Enregistrer" boutonClasse="btn-brand btn-sm self-end" className="mt-1">
                              <input type="hidden" name="articleFournisseurId" value={l.af.id} />
                              <div className="grid grid-cols-4 gap-1">
                                <Champ label="Prix"><ChampNombre name="montant" /></Champ>
                                <Champ label="Base"><select name="base" className="input" defaultValue="ht"><option value="ht">HT</option><option value="ttc">TTC</option></select></Champ>
                                <Champ label="TVA %"><ChampNombre name="tvaPct" defaultValue={prix?.tvaPct ?? 20} /></Champ>
                                <Champ label="Date"><input type="date" name="date" className="input" defaultValue={aujourdHui} /></Champ>
                              </div>
                            </Formulaire>
                          </details>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </Carte>
          );
        })}
      </div>
    </>
  );
}
