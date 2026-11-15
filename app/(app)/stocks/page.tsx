import { BoutonRupture } from "@/components/stocks/BoutonRupture";
import { Badge, Carte, EnTete, Ligne, Vide } from "@/components/ui/primitives";
import { aLeDroit } from "@/lib/auth/droits";
import { exigerSession } from "@/lib/auth/session";
import { instantCourt, journeeExploitation } from "@/lib/dates";
import { fmtNombre } from "@/lib/format";
import { chargerMoteur, joursProchaineLivraisonParArticle } from "@/lib/services/moteur";
import { rupturesOuvertes } from "@/lib/services/ruptures";
import { stocksTheoriques } from "@/lib/services/stock";

export default async function PageStocks({ searchParams }: { searchParams: Promise<{ q?: string; famille?: string }> }) {
  const s = await exigerSession();
  const peutSignaler = aLeDroit(s.poste.role, "rupture:signaler");
  const { q, famille } = await searchParams;
  const [{ moteur, articles, familles }, stocks, ruptures, livraisons] = await Promise.all([chargerMoteur(), stocksTheoriques(), rupturesOuvertes(), joursProchaineLivraisonParArticle()]);
  const enRupture = new Set(ruptures.map((r) => r.r.articleId));
  const aujourdHui = journeeExploitation();
  const familleId = famille ? Number(famille) : null;
  const recherche = (q ?? "").trim().toLowerCase();
  const liste = [...articles.values()]
    .filter((a) => a.statut !== "archive")
    .filter((a) => (familleId ? a.familleId === familleId : true))
    .filter((a) => (recherche ? a.nom.toLowerCase().includes(recherche) : true))
    .sort((x, y) => (x.familleNom ?? "").localeCompare(y.familleNom ?? "", "fr") || x.nom.localeCompare(y.nom, "fr"));
  const cibles = new Map<number, number>();
  for (const a of liste) {
    if (!a.lieAuxVentes) {
      if (a.stockCibleFixe !== null) cibles.set(a.id, a.stockCibleFixe);
      continue;
    }
    try {
      cibles.set(a.id, moteur.stockCible(a.id, aujourdHui, livraisons.get(a.id)?.jours ?? 7).cible);
    } catch {
      /* article sans nomenclature */
    }
  }
  return (
    <>
      <EnTete titre="Stocks" sousTitre="Stock théorique = dernier comptage + réceptions − consommation − pertes." />
      <div className="flex flex-col gap-4">
        {ruptures.length > 0 && (
          <Carte titre={`Ruptures en cours (${ruptures.length})`} className="border-red-300">
            <ul className="divide-rows">
              {ruptures.map((r) => (
                <li key={r.r.id} className="py-2">
                  <span className="font-medium">{r.article}</span> {r.structurant && <Badge teinte="brand">structurant</Badge>}
                  <span className="block text-xs text-muted">
                    signalée le {instantCourt(r.r.signaleeLe)} par {r.prenom ?? "—"}
                    {r.r.commentaire ? ` — ${r.r.commentaire}` : ""} · se lève à la prochaine réception
                  </span>
                </li>
              ))}
            </ul>
          </Carte>
        )}
        <form className="flex gap-2" method="get">
          <input name="q" defaultValue={q ?? ""} className="input flex-1" placeholder="Rechercher un article" />
          <select name="famille" defaultValue={famille ?? ""} className="input w-36">
            <option value="">Toutes familles</option>
            {familles.map((f) => (
              <option key={f.id} value={f.id}>
                {f.nom}
              </option>
            ))}
          </select>
          <button className="btn-ghost" type="submit">
            OK
          </button>
        </form>
        {liste.length === 0 ? (
          <Vide>Aucun article.</Vide>
        ) : (
          <ul className="card divide-rows p-0 px-3">
            {liste.map((a) => {
              const stock = stocks.get(a.id) ?? 0;
              const cible = cibles.get(a.id);
              const bas = cible !== undefined && stock < cible * 0.5;
              return (
                <li key={a.id} className="py-1">
                  <Ligne
                    href={`/stocks/${a.id}`}
                    gauche={
                      <>
                        <span className="font-medium">
                          {a.nom} {enRupture.has(a.id) && <Badge teinte="rouge">rupture</Badge>}
                          {a.statut === "a_verifier" && <Badge teinte="orange">à vérifier</Badge>}
                        </span>
                        <span className="block text-xs text-muted">
                          {a.familleNom}
                          {cible !== undefined ? ` · cible ${fmtNombre(cible, 1)} ${a.uniteComptage}` : ""}
                        </span>
                      </>
                    }
                    droite={
                      <span className={`display text-xl font-bold tabular-nums ${bas ? "text-red-600" : ""}`}>
                        {fmtNombre(stock, 1)} <span className="text-xs font-normal text-muted">{a.uniteComptage}</span>
                      </span>
                    }
                  />
                  {peutSignaler && !enRupture.has(a.id) && a.nature !== "preparation" && (
                    <div className="pb-2 pl-1">
                      <BoutonRupture articleId={a.id} structurant={a.structurant} compact />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}
