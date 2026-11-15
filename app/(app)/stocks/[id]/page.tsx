import Link from "next/link";
import { notFound } from "next/navigation";
import { BoutonRupture } from "@/components/stocks/BoutonRupture";
import { Badge, Carte, Chiffre, EnTete, Vide } from "@/components/ui/primitives";
import { aLeDroit } from "@/lib/auth/droits";
import { exigerSession } from "@/lib/auth/session";
import { instantCourt, journeeExploitation } from "@/lib/dates";
import { fmtDH, fmtNombre } from "@/lib/format";
import { historiquePrix } from "@/lib/services/catalogue";
import { chargerMoteur, joursProchaineLivraisonParArticle } from "@/lib/services/moteur";
import { articlesEnRupture } from "@/lib/services/ruptures";
import { mouvementsArticle, stockTheorique } from "@/lib/services/stock";

const NATURE_MVT: Record<string, string> = { comptage: "Comptage", reception: "Réception", consommation: "Consommation", perte: "Perte", correction: "Correction" };

export default async function PageArticle({ params }: { params: Promise<{ id: string }> }) {
  const s = await exigerSession();
  const { id } = await params;
  const { moteur, articles } = await chargerMoteur();
  const a = articles.get(Number(id));
  if (!a) notFound();
  const aujourdHui = journeeExploitation();
  const [stock, mouvements, ruptures, livraisons, prix] = await Promise.all([
    stockTheorique(a.id),
    mouvementsArticle(a.id, 40),
    articlesEnRupture(),
    joursProchaineLivraisonParArticle(),
    aLeDroit(s.poste.role, "prix:lire") ? historiquePrix(a.id, 10) : Promise.resolve([]),
  ]);
  let cible: ReturnType<typeof moteur.stockCible> | null = null;
  if (a.lieAuxVentes && a.nature !== "preparation") {
    try {
      cible = moteur.stockCible(a.id, aujourdHui, livraisons.get(a.id)?.jours ?? 7);
    } catch {
      cible = null;
    }
  }
  const besoinJour = (() => {
    try {
      return moteur.besoinAchat(a.id, aujourdHui);
    } catch {
      return null;
    }
  })();
  return (
    <>
      <EnTete
        titre={a.nom}
        retour="/stocks"
        sousTitre={
          <>
            {a.familleNom} · {a.uniteComptage}
            {a.structurant && <> · <Badge teinte="brand">structurant</Badge></>}
            {ruptures.has(a.id) && <> · <Badge teinte="rouge">en rupture</Badge></>}
            {a.dlcJours !== null && ` · DLC ${a.dlcJours} j`}
          </>
        }
        action={aLeDroit(s.poste.role, "parametres:ecrire") ? <Link href={`/parametres/articles/${a.id}`} className="btn-ghost btn-sm">Fiche</Link> : undefined}
      />
      <div className="mb-4 grid grid-cols-2 gap-2">
        <Chiffre libelle="Stock théorique" valeur={`${fmtNombre(stock, 1)} ${a.uniteComptage}`} />
        {cible ? (
          <Chiffre libelle={`Cible (${cible.couverture} j)`} valeur={`${fmtNombre(cible.cible, 1)} ${a.uniteComptage}`} detail={`besoin du jour ${fmtNombre(cible.besoinJour, 1)}`} teinte={stock < cible.cible * 0.5 ? "rouge" : undefined} />
        ) : a.stockCibleFixe !== null ? (
          <Chiffre libelle="Cible fixe" valeur={`${fmtNombre(a.stockCibleFixe, 0)} ${a.uniteComptage}`} detail={a.stockMinimum !== null ? `minimum ${fmtNombre(a.stockMinimum, 0)}` : undefined} teinte={a.stockMinimum !== null && stock < a.stockMinimum ? "rouge" : undefined} />
        ) : (
          <Chiffre libelle="Besoin du jour" valeur={besoinJour === null ? "—" : `${fmtNombre(besoinJour, 1)} ${a.uniteComptage}`} />
        )}
      </div>
      {aLeDroit(s.poste.role, "rupture:signaler") && !ruptures.has(a.id) && a.nature !== "preparation" && (
        <div className="mb-4">
          <BoutonRupture articleId={a.id} structurant={a.structurant} />
        </div>
      )}
      {prix.length > 0 && (
        <Carte titre="Prix d'achat" className="mb-4">
          <ul className="divide-rows text-sm">
            {prix.map((p) => (
              <li key={p.prix.id} className="flex justify-between py-1.5">
                <span>
                  {p.fournisseur} <span className="text-xs text-muted">/ {p.uniteCommande}</span>
                </span>
                <span className="tabular-nums">
                  {fmtDH(Number(p.prix.prixHt), 2)} HT <span className="text-xs text-muted">{p.prix.date}</span>
                </span>
              </li>
            ))}
          </ul>
        </Carte>
      )}
      <Carte titre="Mouvements récents">
        {mouvements.length === 0 ? (
          <Vide>Aucun mouvement. Le premier comptage fixera le stock.</Vide>
        ) : (
          <ul className="divide-rows text-sm">
            {mouvements.map((m) => {
              const q = Number(m.quantite);
              return (
                <li key={m.id} className="flex items-center justify-between gap-2 py-1.5">
                  <span className="min-w-0">
                    <span className="font-medium">{NATURE_MVT[m.nature] ?? m.nature}</span>
                    <span className="block truncate text-xs text-muted">
                      {instantCourt(m.at)}
                      {m.note ? ` · ${m.note}` : ""}
                    </span>
                  </span>
                  <span className={`shrink-0 tabular-nums ${q < 0 ? "text-red-600" : "text-emerald-700"}`}>
                    {q > 0 ? "+" : ""}
                    {fmtNombre(q, 2)}
                    {m.stockApres !== null && <span className="block text-right text-xs text-muted">→ {fmtNombre(Number(m.stockApres), 1)}</span>}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Carte>
    </>
  );
}
