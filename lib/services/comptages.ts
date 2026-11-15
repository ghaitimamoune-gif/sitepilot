import { and, desc, eq, gt, sql as dsql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { journeeExploitation } from "@/lib/dates";
import { creerAlerte } from "./alertes";
import { dernierModeConsommation } from "./consommation";
import { journaliser, type Acteur } from "./journal";
import { chargerMoteur } from "./moteur";
import { chargerParametres, nombreDepuis } from "./parametres";
import { derniersPrix, enregistrerMouvement, prixUnitaireComptage, stocksTheoriques } from "./stock";
import { validerTacheLiee } from "./taches";

export interface LigneComptageVue {
  id: number;
  articleId: number;
  nom: string;
  unite: string;
  estPiece: boolean;
  structurant: boolean;
  quantiteComptee: number | null;
  saisiLe: Date | null;
  stockTheorique: number | null;
  ecart: number | null;
  ecartPct: number | null;
  ecartValeur: number | null;
}

/** Ouvre (ou reprend) le comptage du jour d'une famille. Les lignes sont créées sans stock théorique visible. */
export async function ouvrirComptage(acteur: Acteur, familleId: number, fermeture = false) {
  const journee = journeeExploitation();
  const [existant] = await db
    .select()
    .from(schema.comptages)
    .where(
      and(
        eq(schema.comptages.familleId, familleId),
        eq(schema.comptages.date, journee),
        eq(schema.comptages.fermeture, fermeture),
        eq(schema.comptages.statut, "en_cours"),
      ),
    );
  if (existant) return existant;
  const charge = await chargerMoteur();
  // Le comptage de fermeture porte sur les produits critiques du coût matière, quelle que soit leur famille.
  const articles = [...charge.articles.values()].filter((a) =>
    a.statut === "archive" ? false : fermeture ? a.critique : a.familleId === familleId,
  );
  const [c] = await db
    .insert(schema.comptages)
    .values({ familleId, date: journee, fermeture, posteId: acteur.posteId!, personneId: acteur.personneId! })
    .returning();
  if (articles.length > 0) {
    await db.insert(schema.comptageLignes).values(articles.map((a) => ({ comptageId: c.id, articleId: a.id })));
  }
  await journaliser(acteur, "comptage", "ouvrir", { entiteId: c.id, apres: { familleId, fermeture } });
  return c;
}

export async function comptageAvecLignes(comptageId: number): Promise<{ comptage: typeof schema.comptages.$inferSelect; lignes: LigneComptageVue[] } | null> {
  const [c] = await db.select().from(schema.comptages).where(eq(schema.comptages.id, comptageId));
  if (!c) return null;
  const charge = await chargerMoteur();
  const lignes = await db.select().from(schema.comptageLignes).where(eq(schema.comptageLignes.comptageId, comptageId));
  const vue: LigneComptageVue[] = lignes
    .map((l) => {
      const a = charge.articles.get(l.articleId);
      return {
        id: l.id,
        articleId: l.articleId,
        nom: a?.nom ?? `Article ${l.articleId}`,
        unite: a?.uniteComptage ?? "",
        estPiece: a?.estPiece ?? false,
        structurant: a?.structurant ?? false,
        quantiteComptee: l.quantiteComptee === null ? null : Number(l.quantiteComptee),
        saisiLe: l.saisiLe,
        stockTheorique: l.stockTheorique === null ? null : Number(l.stockTheorique),
        ecart: l.ecart === null ? null : Number(l.ecart),
        ecartPct: l.ecartPct === null ? null : Number(l.ecartPct),
        ecartValeur: l.ecartValeur === null ? null : Number(l.ecartValeur),
      };
    })
    .sort((x, y) => x.nom.localeCompare(y.nom, "fr"));
  return { comptage: c, lignes: vue };
}

/** Chaque ligne est enregistrée dès sa saisie. */
export async function saisirLigneComptage(acteur: Acteur, comptageId: number, articleId: number, quantite: number | null): Promise<void> {
  const [c] = await db.select().from(schema.comptages).where(eq(schema.comptages.id, comptageId));
  if (!c || c.statut !== "en_cours") throw new Error("Ce comptage est déjà validé.");
  await db
    .update(schema.comptageLignes)
    .set({ quantiteComptee: quantite === null ? null : String(quantite), saisiLe: new Date(), personneId: acteur.personneId })
    .where(and(eq(schema.comptageLignes.comptageId, comptageId), eq(schema.comptageLignes.articleId, articleId)));
}

/** Ajoute un article du catalogue à un comptage en cours (article hors famille, par exemple). */
export async function ajouterLigneComptage(comptageId: number, articleId: number): Promise<void> {
  await db.insert(schema.comptageLignes).values({ comptageId, articleId }).onConflictDoNothing();
}

/**
 * Validation : écart ligne par ligne, recalage du stock sur le chiffre compté, alertes
 * pour les articles structurants au-dessus du seuil. Les lignes non saisies sont ignorées.
 */
export async function validerComptage(acteur: Acteur, comptageId: number): Promise<{ lignes: LigneComptageVue[]; alertes: number }> {
  const [c] = await db.select().from(schema.comptages).where(eq(schema.comptages.id, comptageId));
  if (!c) throw new Error("Comptage introuvable.");
  if (c.statut === "valide") {
    const v = await comptageAvecLignes(comptageId);
    return { lignes: v?.lignes ?? [], alertes: 0 };
  }
  const [charge, p, prixMap, mode] = await Promise.all([chargerMoteur(), chargerParametres(), derniersPrix(), dernierModeConsommation()]);
  const seuilStructurant = nombreDepuis(p, "seuil_ecart_stock_structurant");
  const seuilEstime = nombreDepuis(p, "seuil_ecart_stock_estime");
  const seuil = mode === "import" ? seuilStructurant : seuilEstime;
  const lignes = await db.select().from(schema.comptageLignes).where(eq(schema.comptageLignes.comptageId, comptageId));
  const saisies = lignes.filter((l) => l.quantiteComptee !== null);
  const stocks = await stocksTheoriques(saisies.map((l) => l.articleId));
  let nbAlertes = 0;
  const maintenant = new Date();
  await db.transaction(async (tx) => {
    for (const l of saisies) {
      const compte = Number(l.quantiteComptee);
      const theorique = stocks.get(l.articleId) ?? 0;
      const ecart = compte - theorique;
      // Consommation théorique depuis le dernier comptage validé de l'article.
      const [dernier] = await tx
        .select({ at: schema.mouvementsStock.at })
        .from(schema.mouvementsStock)
        .where(and(eq(schema.mouvementsStock.articleId, l.articleId), eq(schema.mouvementsStock.nature, "comptage")))
        .orderBy(desc(schema.mouvementsStock.at))
        .limit(1);
      const [conso] = await tx
        .select({ total: dsql<string>`coalesce(sum(${schema.mouvementsStock.quantite}), 0)` })
        .from(schema.mouvementsStock)
        .where(
          and(
            eq(schema.mouvementsStock.articleId, l.articleId),
            eq(schema.mouvementsStock.nature, "consommation"),
            dernier ? gt(schema.mouvementsStock.at, dernier.at) : dsql`true`,
          ),
        );
      const consommation = -Number(conso?.total ?? 0);
      const denominateur = consommation > 0 ? consommation : Math.max(Math.abs(theorique), Math.abs(compte), 1);
      const ecartPct = ecart / denominateur;
      const prixUnit = prixUnitaireComptage(prixMap.get(l.articleId));
      const ecartValeur = prixUnit === null ? null : ecart * prixUnit;
      await tx
        .update(schema.comptageLignes)
        .set({
          stockTheorique: String(theorique),
          ecart: String(ecart),
          ecartPct: String(ecartPct),
          ecartValeur: ecartValeur === null ? null : String(ecartValeur),
        })
        .where(eq(schema.comptageLignes.id, l.id));
      await enregistrerMouvement(tx, {
        articleId: l.articleId,
        nature: "comptage",
        quantite: ecart,
        stockApres: compte,
        origineType: "comptage",
        origineId: comptageId,
        posteId: acteur.posteId,
        personneId: acteur.personneId,
        at: maintenant,
      });
      const a = charge.articles.get(l.articleId);
      // Premier comptage d'un article : c'est une initialisation du stock, pas un écart.
      if (a?.structurant && dernier && Math.abs(ecartPct) > seuil) {
        nbAlertes++;
        await creerAlerte(
          {
            type: "ecart_stock",
            niveau: "critique",
            titre: `Écart de stock : ${a.nom}`,
            detail: `Compté ${compte} ${a.uniteComptage}, théorique ${theorique.toFixed(1)} : écart ${ecart > 0 ? "+" : ""}${ecart.toFixed(1)} (${(ecartPct * 100).toFixed(0)} %${ecartValeur !== null ? `, ${ecartValeur.toFixed(0)} DH` : ""}). Consommation ${mode === "import" ? "exacte (ventes importées)" : "estimée depuis le CA"}.`,
            objetType: "comptage",
            objetId: comptageId,
            roles: ["proprietaire"],
          },
          tx,
        );
      }
    }
    await tx
      .update(schema.comptages)
      .set({ statut: "valide", valideLe: maintenant, modeConsommation: mode ?? "estime" })
      .where(eq(schema.comptages.id, comptageId));
  });
  await journaliser(acteur, "comptage", "valider", { entiteId: comptageId, apres: { lignes: saisies.length, alertes: nbAlertes } });
  await validerTacheLiee(acteur, c.fermeture ? "comptage_fermeture" : "comptage", c.familleId);
  const v = await comptageAvecLignes(comptageId);
  return { lignes: v?.lignes ?? [], alertes: nbAlertes };
}

export async function comptagesEnCours(posteId: number) {
  return db
    .select()
    .from(schema.comptages)
    .where(and(eq(schema.comptages.posteId, posteId), eq(schema.comptages.statut, "en_cours")))
    .orderBy(desc(schema.comptages.creeLe));
}

export async function historiqueComptages(limite = 30) {
  return db
    .select({ c: schema.comptages, famille: schema.familles.nom, prenom: schema.personnes.prenom })
    .from(schema.comptages)
    .innerJoin(schema.familles, eq(schema.familles.id, schema.comptages.familleId))
    .leftJoin(schema.personnes, eq(schema.personnes.id, schema.comptages.personneId))
    .orderBy(desc(schema.comptages.creeLe))
    .limit(limite);
}

/** Dernier comptage validé de chaque famille (pour savoir ce qui est dû). */
export async function derniersComptagesParFamille(): Promise<Map<number, string>> {
  const rows = await db
    .select({ familleId: schema.comptages.familleId, date: dsql<string>`max(${schema.comptages.date})` })
    .from(schema.comptages)
    .where(and(eq(schema.comptages.statut, "valide"), eq(schema.comptages.fermeture, false)))
    .groupBy(schema.comptages.familleId);
  return new Map(rows.map((r) => [r.familleId, r.date]));
}

/**
 * Stock du matin et du soir des produits critiques, pour le coût matière.
 * Matin : comptage quotidien du jour ; à défaut (article compté chaque semaine, comme le cheddar),
 * le dernier comptage validé avant l'ouverture, en pratique celui de fermeture de la veille.
 * Soir : comptage de fermeture du jour.
 */
export async function comptagesCritiquesDuJour(date: string): Promise<{ matin: Map<number, number>; soir: Map<number, number> }> {
  const rows = await db
    .select({ fermeture: schema.comptages.fermeture, articleId: schema.comptageLignes.articleId, q: schema.comptageLignes.quantiteComptee })
    .from(schema.comptages)
    .innerJoin(schema.comptageLignes, eq(schema.comptageLignes.comptageId, schema.comptages.id))
    .where(and(eq(schema.comptages.date, date), eq(schema.comptages.statut, "valide")));
  const matin = new Map<number, number>();
  const soir = new Map<number, number>();
  for (const r of rows) {
    if (r.q === null) continue;
    (r.fermeture ? soir : matin).set(r.articleId, Number(r.q));
  }
  const precedents = await db.execute(dsql`
    select distinct on (l.article_id) l.article_id as "articleId", l.quantite_comptee as q
    from comptage_lignes l
    join comptages c on c.id = l.comptage_id
    where c.statut = 'valide' and c.date < ${date} and l.quantite_comptee is not null
    order by l.article_id, c.date desc, c.valide_le desc
  `);
  for (const r of precedents as unknown as { articleId: number; q: string }[]) {
    if (!matin.has(Number(r.articleId))) matin.set(Number(r.articleId), Number(r.q));
  }
  return { matin, soir };
}
