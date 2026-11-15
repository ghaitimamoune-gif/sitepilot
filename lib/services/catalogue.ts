import { and, asc, desc, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { dateLocale, type ISODate } from "@/lib/dates";
import type { TypeJournee } from "@/lib/engine/types";
import { creerAlerte } from "./alertes";
import { journaliser, type Acteur } from "./journal";
import { chargerParametres, nombreDepuis } from "./parametres";

// ---------------------------------------------------------------------------
// Fournisseurs
// ---------------------------------------------------------------------------

export interface FicheFournisseur {
  nom: string;
  raisonSociale?: string | null;
  ice?: string | null;
  contact?: string | null;
  whatsapp?: string | null;
  joursLivraison?: number[];
  heureLimite?: string | null;
  delaiJours?: number;
  validationRequise?: boolean;
  achatDirect?: boolean;
  statut?: "actif" | "a_verifier" | "archive";
}

/**
 * Fiche minimale créée sur le terrain (commandes ou réceptions) : nom, WhatsApp, articles fournis.
 * Utilisable immédiatement, marquée « à vérifier » et signalée aux propriétaires.
 */
export async function creerFournisseurTerrain(
  acteur: Acteur,
  f: { nom: string; whatsapp?: string | null; contact?: string | null; articleIds: number[] },
): Promise<number> {
  const nom = f.nom.trim();
  if (!nom) throw new Error("Le nom est obligatoire.");
  const id = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(schema.fournisseurs)
      .values({ nom, whatsapp: f.whatsapp?.trim() || null, contact: f.contact?.trim() || null, statut: "a_verifier", creeParPosteId: acteur.posteId })
      .returning({ id: schema.fournisseurs.id });
    for (const articleId of f.articleIds) {
      const [a] = await tx.select().from(schema.articles).where(eq(schema.articles.id, articleId));
      if (!a) continue;
      await tx
        .insert(schema.articleFournisseurs)
        .values({ articleId, fournisseurId: row.id, uniteCommande: a.uniteComptage, qteParUniteCommande: "1" })
        .onConflictDoNothing();
    }
    await creerAlerte(
      {
        type: "fiche_a_verifier",
        niveau: "a_traiter",
        titre: `Nouveau fournisseur à vérifier : ${nom}`,
        detail: "Créé sur le terrain. Compléter la fiche (jours de livraison, heure limite) et décider s'il est soumis à validation.",
        objetType: "fournisseur",
        objetId: row.id,
        roles: ["proprietaire"],
        cleUnique: `fiche_fournisseur:${row.id}`,
      },
      tx,
    );
    await journaliser(acteur, "fournisseur", "creer_terrain", { entiteId: row.id, apres: { nom, articleIds: f.articleIds }, tx });
    return row.id;
  });
  return id;
}

export async function enregistrerFournisseur(acteur: Acteur, id: number | null, f: FicheFournisseur): Promise<number> {
  const nom = f.nom.trim();
  if (!nom) throw new Error("Le nom est obligatoire.");
  const valeurs = {
    nom,
    raisonSociale: f.raisonSociale?.trim() || null,
    ice: f.ice?.trim() || null,
    contact: f.contact?.trim() || null,
    whatsapp: f.whatsapp?.trim() || null,
    joursLivraison: f.joursLivraison ?? [],
    heureLimite: f.heureLimite?.trim() || null,
    delaiJours: Math.max(1, f.delaiJours ?? 1),
    validationRequise: f.validationRequise ?? false,
    achatDirect: f.achatDirect ?? false,
    statut: f.statut ?? "actif",
  };
  if (id === null) {
    const [row] = await db.insert(schema.fournisseurs).values(valeurs).returning({ id: schema.fournisseurs.id });
    await journaliser(acteur, "fournisseur", "creer", { entiteId: row.id, apres: valeurs });
    return row.id;
  }
  const [avant] = await db.select().from(schema.fournisseurs).where(eq(schema.fournisseurs.id, id));
  await db.update(schema.fournisseurs).set(valeurs).where(eq(schema.fournisseurs.id, id));
  if (avant?.statut === "a_verifier" && valeurs.statut === "actif") {
    await db.update(schema.alertes).set({ traiteeLe: new Date(), traiteeParPosteId: acteur.posteId, note: "Fiche complétée" }).where(and(eq(schema.alertes.cleUnique, `fiche_fournisseur:${id}`)));
  }
  await journaliser(acteur, "fournisseur", "modifier", { entiteId: id, avant, apres: valeurs });
  return id;
}

export async function fournisseurAvecArticles(id: number) {
  const [f] = await db.select().from(schema.fournisseurs).where(eq(schema.fournisseurs.id, id));
  if (!f) return null;
  const liens = await db
    .select({ af: schema.articleFournisseurs, article: schema.articles })
    .from(schema.articleFournisseurs)
    .innerJoin(schema.articles, eq(schema.articles.id, schema.articleFournisseurs.articleId))
    .where(eq(schema.articleFournisseurs.fournisseurId, id))
    .orderBy(asc(schema.articles.nom));
  const prixRows = await db
    .select()
    .from(schema.prix)
    .innerJoin(schema.articleFournisseurs, eq(schema.articleFournisseurs.id, schema.prix.articleFournisseurId))
    .where(eq(schema.articleFournisseurs.fournisseurId, id))
    .orderBy(desc(schema.prix.date), desc(schema.prix.id));
  const dernierPrix = new Map<number, { prixHt: number; tvaPct: number; date: ISODate }>();
  for (const r of prixRows) if (!dernierPrix.has(r.prix.articleFournisseurId)) dernierPrix.set(r.prix.articleFournisseurId, { prixHt: Number(r.prix.prixHt), tvaPct: Number(r.prix.tvaPct), date: r.prix.date });
  return { fournisseur: f, liens: liens.map((l) => ({ ...l, dernierPrix: dernierPrix.get(l.af.id) ?? null })) };
}

export async function lierArticleFournisseur(
  acteur: Acteur,
  v: { articleId: number; fournisseurId: number; uniteCommande: string; qteParUniteCommande: number; reference?: string | null; designation?: string | null; actif?: boolean },
): Promise<number> {
  const valeurs = {
    uniteCommande: v.uniteCommande.trim() || "unité",
    qteParUniteCommande: String(v.qteParUniteCommande > 0 ? v.qteParUniteCommande : 1),
    reference: v.reference?.trim() || null,
    designation: v.designation?.trim() || null,
    actif: v.actif ?? true,
  };
  const [row] = await db
    .insert(schema.articleFournisseurs)
    .values({ articleId: v.articleId, fournisseurId: v.fournisseurId, ...valeurs })
    .onConflictDoUpdate({ target: [schema.articleFournisseurs.articleId, schema.articleFournisseurs.fournisseurId], set: valeurs })
    .returning({ id: schema.articleFournisseurs.id });
  await journaliser(acteur, "article_fournisseur", "enregistrer", { entiteId: row.id, apres: { ...v } });
  return row.id;
}

// ---------------------------------------------------------------------------
// Prix
// ---------------------------------------------------------------------------

/** Les factures portent tantôt des prix HT, tantôt TTC : on stocke le HT avec son taux. */
export function prixHorsTaxe(montant: number, tvaPct: number, estTtc: boolean): number {
  if (!estTtc) return montant;
  return montant / (1 + tvaPct / 100);
}

export async function enregistrerPrix(
  acteur: Acteur,
  v: { articleFournisseurId: number; montant: number; tvaPct: number; estTtc: boolean; date?: ISODate; photoId?: number | null },
): Promise<void> {
  const prixHt = prixHorsTaxe(v.montant, v.tvaPct, v.estTtc);
  const [af] = await db
    .select({ af: schema.articleFournisseurs, article: schema.articles })
    .from(schema.articleFournisseurs)
    .innerJoin(schema.articles, eq(schema.articles.id, schema.articleFournisseurs.articleId))
    .where(eq(schema.articleFournisseurs.id, v.articleFournisseurId));
  if (!af) throw new Error("Lien article-fournisseur introuvable.");
  const [precedent] = await db
    .select()
    .from(schema.prix)
    .where(eq(schema.prix.articleFournisseurId, v.articleFournisseurId))
    .orderBy(desc(schema.prix.date), desc(schema.prix.id))
    .limit(1);
  await db.insert(schema.prix).values({
    articleFournisseurId: v.articleFournisseurId,
    prixHt: String(prixHt),
    tvaPct: String(v.tvaPct),
    date: v.date ?? dateLocale(),
    photoId: v.photoId ?? null,
    saisiParPosteId: acteur.posteId,
    saisiParPersonneId: acteur.personneId,
  });
  await journaliser(acteur, "prix", "saisir", { entiteId: v.articleFournisseurId, avant: precedent ? { prixHt: precedent.prixHt } : null, apres: { prixHt, tvaPct: v.tvaPct } });
  if (af.article.structurant && precedent) {
    const p = await chargerParametres();
    const seuil = nombreDepuis(p, "seuil_hausse_prix");
    const ancien = Number(precedent.prixHt);
    if (ancien > 0 && (prixHt - ancien) / ancien > seuil) {
      await creerAlerte({
        type: "hausse_prix",
        niveau: "avertissement",
        titre: `Hausse de prix : ${af.article.nom}`,
        detail: `${ancien.toFixed(2)} → ${prixHt.toFixed(2)} DH HT (+${(((prixHt - ancien) / ancien) * 100).toFixed(1)} %).`,
        objetType: "article",
        objetId: af.article.id,
        roles: ["proprietaire"],
      });
    }
  }
}

export async function historiquePrix(articleId: number, limite = 50) {
  return db
    .select({ prix: schema.prix, fournisseur: schema.fournisseurs.nom, uniteCommande: schema.articleFournisseurs.uniteCommande })
    .from(schema.prix)
    .innerJoin(schema.articleFournisseurs, eq(schema.articleFournisseurs.id, schema.prix.articleFournisseurId))
    .innerJoin(schema.fournisseurs, eq(schema.fournisseurs.id, schema.articleFournisseurs.fournisseurId))
    .where(eq(schema.articleFournisseurs.articleId, articleId))
    .orderBy(desc(schema.prix.date), desc(schema.prix.id))
    .limit(limite);
}

// ---------------------------------------------------------------------------
// Articles
// ---------------------------------------------------------------------------

export interface FicheArticle {
  nom: string;
  nature: (typeof schema.natureArticleEnum.enumValues)[number];
  familleId: number | null;
  famillePerteId: number | null;
  uniteComptage: string;
  poidsUnitaire?: number | null;
  unitePoids?: string | null;
  structurant?: boolean;
  dlcJours?: number | null;
  rendementParage?: number | null;
  lieAuxVentes?: boolean;
  stockMinimum?: number | null;
  stockCibleFixe?: number | null;
  partAvance?: number | null;
  rendementBatch?: number | null;
  uniteBatch?: string | null;
  coutRevient?: number | null;
  critiqueCoutMatiere?: boolean;
  statut?: "actif" | "a_verifier" | "archive";
  aConfirmer?: boolean;
}

const s = (n: number | null | undefined) => (n === null || n === undefined ? null : String(n));

/** Article créé sur le terrain : nom, famille, unité de comptage, conditionnement. */
export async function creerArticleTerrain(
  acteur: Acteur,
  a: { nom: string; familleId: number; uniteComptage: string; fournisseurId?: number | null; uniteCommande?: string | null; qteParUniteCommande?: number | null },
): Promise<number> {
  const nom = a.nom.trim();
  if (!nom) throw new Error("Le nom est obligatoire.");
  const [famille] = await db.select().from(schema.familles).where(eq(schema.familles.id, a.familleId));
  if (!famille) throw new Error("Famille inconnue.");
  const nature = famille.roleCompteur === "resp_achats" ? "consommable" : "matiere_premiere";
  const lieAuxVentes = nature === "matiere_premiere";
  const id = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(schema.articles)
      .values({
        nom,
        nature,
        familleId: a.familleId,
        uniteComptage: a.uniteComptage.trim() || "unité",
        lieAuxVentes,
        statut: "a_verifier",
        aConfirmer: true,
        creeParPosteId: acteur.posteId,
        dlcJours: lieAuxVentes ? 7 : null,
      })
      .returning({ id: schema.articles.id });
    if (a.fournisseurId) {
      await tx.insert(schema.articleFournisseurs).values({
        articleId: row.id,
        fournisseurId: a.fournisseurId,
        uniteCommande: a.uniteCommande?.trim() || a.uniteComptage.trim() || "unité",
        qteParUniteCommande: String(a.qteParUniteCommande && a.qteParUniteCommande > 0 ? a.qteParUniteCommande : 1),
      });
    }
    await creerAlerte(
      {
        type: "fiche_a_verifier",
        niveau: "a_traiter",
        titre: `Nouvel article à vérifier : ${nom}`,
        detail: `Créé sur le terrain dans la famille ${famille.nom}. Compléter DLC, famille de perte, nomenclature si besoin.`,
        objetType: "article",
        objetId: row.id,
        roles: ["proprietaire"],
        cleUnique: `fiche_article:${row.id}`,
      },
      tx,
    );
    await journaliser(acteur, "article", "creer_terrain", { entiteId: row.id, apres: { nom, familleId: a.familleId }, tx });
    return row.id;
  });
  return id;
}

export async function enregistrerArticle(acteur: Acteur, id: number | null, a: FicheArticle): Promise<number> {
  const nom = a.nom.trim();
  if (!nom) throw new Error("Le nom est obligatoire.");
  const valeurs = {
    nom,
    nature: a.nature,
    familleId: a.familleId,
    famillePerteId: a.famillePerteId,
    uniteComptage: a.uniteComptage.trim() || "unité",
    poidsUnitaire: s(a.poidsUnitaire),
    unitePoids: a.unitePoids?.trim() || null,
    structurant: a.structurant ?? false,
    dlcJours: a.dlcJours ?? null,
    rendementParage: s(a.rendementParage),
    lieAuxVentes: a.lieAuxVentes ?? true,
    stockMinimum: s(a.stockMinimum),
    stockCibleFixe: s(a.stockCibleFixe),
    partAvance: s(a.partAvance),
    rendementBatch: s(a.rendementBatch),
    uniteBatch: a.uniteBatch?.trim() || null,
    coutRevient: s(a.coutRevient),
    critiqueCoutMatiere: a.critiqueCoutMatiere ?? false,
    statut: a.statut ?? "actif",
    aConfirmer: a.aConfirmer ?? false,
  };
  if (id === null) {
    const [row] = await db.insert(schema.articles).values(valeurs).returning({ id: schema.articles.id });
    await journaliser(acteur, "article", "creer", { entiteId: row.id, apres: valeurs });
    return row.id;
  }
  const [avant] = await db.select().from(schema.articles).where(eq(schema.articles.id, id));
  await db.update(schema.articles).set(valeurs).where(eq(schema.articles.id, id));
  if (avant?.statut === "a_verifier" && valeurs.statut === "actif") {
    await db.update(schema.alertes).set({ traiteeLe: new Date(), traiteeParPosteId: acteur.posteId, note: "Fiche complétée" }).where(eq(schema.alertes.cleUnique, `fiche_article:${id}`));
  }
  await journaliser(acteur, "article", "modifier", { entiteId: id, avant, apres: valeurs });
  return id;
}

// ---------------------------------------------------------------------------
// Familles, nomenclature, recettes, produits, coefficients
// ---------------------------------------------------------------------------

export async function enregistrerFamille(acteur: Acteur, id: number | null, f: { nom: string; rythme: "quotidien" | "hebdomadaire" | "mensuel"; roleCompteur: "resp_cuisine" | "resp_achats"; joursSecurite: number }): Promise<void> {
  const valeurs = { nom: f.nom.trim(), rythme: f.rythme, roleCompteur: f.roleCompteur, joursSecurite: Math.max(0, f.joursSecurite) };
  if (id === null) {
    const [row] = await db.insert(schema.familles).values(valeurs).returning({ id: schema.familles.id });
    await journaliser(acteur, "famille", "creer", { entiteId: row.id, apres: valeurs });
    return;
  }
  const [avant] = await db.select().from(schema.familles).where(eq(schema.familles.id, id));
  await db.update(schema.familles).set(valeurs).where(eq(schema.familles.id, id));
  await journaliser(acteur, "famille", "modifier", { entiteId: id, avant, apres: valeurs });
}

export async function enregistrerFamillePerte(acteur: Acteur, id: number, pertePct: number): Promise<void> {
  const [avant] = await db.select().from(schema.famillesPerte).where(eq(schema.famillesPerte.id, id));
  await db.update(schema.famillesPerte).set({ pertePct: String(pertePct) }).where(eq(schema.famillesPerte.id, id));
  await journaliser(acteur, "famille_perte", "modifier", { entiteId: id, avant: { pertePct: avant?.pertePct }, apres: { pertePct } });
}

export async function enregistrerNomenclature(acteur: Acteur, produitId: number, articleId: number, quantite: number | null, aConfirmer = false): Promise<void> {
  const [avant] = await db
    .select()
    .from(schema.nomenclature)
    .where(and(eq(schema.nomenclature.produitId, produitId), eq(schema.nomenclature.articleId, articleId)));
  if (quantite === null || quantite <= 0) {
    if (avant) await db.delete(schema.nomenclature).where(eq(schema.nomenclature.id, avant.id));
  } else {
    await db
      .insert(schema.nomenclature)
      .values({ produitId, articleId, quantite: String(quantite), aConfirmer })
      .onConflictDoUpdate({ target: [schema.nomenclature.produitId, schema.nomenclature.articleId], set: { quantite: String(quantite), aConfirmer } });
  }
  await journaliser(acteur, "nomenclature", "modifier", { entiteId: produitId, avant: avant ? { articleId, quantite: avant.quantite } : null, apres: { articleId, quantite } });
}

export async function enregistrerRecette(acteur: Acteur, preparationId: number, ingredientId: number, quantiteParBatch: number | null): Promise<void> {
  const [avant] = await db
    .select()
    .from(schema.recetteLignes)
    .where(and(eq(schema.recetteLignes.preparationId, preparationId), eq(schema.recetteLignes.ingredientId, ingredientId)));
  if (quantiteParBatch === null || quantiteParBatch <= 0) {
    if (avant) await db.delete(schema.recetteLignes).where(eq(schema.recetteLignes.id, avant.id));
  } else {
    await db
      .insert(schema.recetteLignes)
      .values({ preparationId, ingredientId, quantiteParBatch: String(quantiteParBatch) })
      .onConflictDoUpdate({ target: [schema.recetteLignes.preparationId, schema.recetteLignes.ingredientId], set: { quantiteParBatch: String(quantiteParBatch) } });
  }
  await journaliser(acteur, "recette", "modifier", { entiteId: preparationId, avant: avant ? { ingredientId, quantiteParBatch: avant.quantiteParBatch } : null, apres: { ingredientId, quantiteParBatch } });
}

export async function enregistrerProduit(acteur: Acteur, id: number | null, p: { nom: string; categorie: string | null; libellesCaisse: string[]; actif: boolean }): Promise<number> {
  const valeurs = { nom: p.nom.trim(), categorie: p.categorie?.trim() || null, libellesCaisse: p.libellesCaisse.map((l) => l.trim()).filter(Boolean), actif: p.actif };
  if (id === null) {
    const [row] = await db.insert(schema.produitsVendus).values(valeurs).returning({ id: schema.produitsVendus.id });
    for (const type of ["semaine", "weekend"] as const) await db.insert(schema.coefficients).values({ produitId: row.id, typeJournee: type, valeurMesuree: "0" }).onConflictDoNothing();
    await journaliser(acteur, "produit_vendu", "creer", { entiteId: row.id, apres: valeurs });
    return row.id;
  }
  const [avant] = await db.select().from(schema.produitsVendus).where(eq(schema.produitsVendus.id, id));
  await db.update(schema.produitsVendus).set(valeurs).where(eq(schema.produitsVendus.id, id));
  await journaliser(acteur, "produit_vendu", "modifier", { entiteId: id, avant, apres: valeurs });
  return id;
}

/** Un propriétaire peut personnaliser un coefficient, et le figer à une valeur choisie. */
export async function enregistrerCoefficient(acteur: Acteur, produitId: number, type: TypeJournee, v: { valeurPerso: number | null; fige: boolean; valeurMesuree?: number | null }): Promise<void> {
  const [avant] = await db
    .select()
    .from(schema.coefficients)
    .where(and(eq(schema.coefficients.produitId, produitId), eq(schema.coefficients.typeJournee, type)));
  const set = {
    valeurPerso: s(v.valeurPerso),
    fige: v.fige,
    ...(v.valeurMesuree !== undefined && v.valeurMesuree !== null ? { valeurMesuree: String(v.valeurMesuree) } : {}),
    modifieLe: new Date(),
  };
  await db
    .insert(schema.coefficients)
    .values({ produitId, typeJournee: type, valeurMesuree: s(v.valeurMesuree) ?? "0", ...set })
    .onConflictDoUpdate({ target: [schema.coefficients.produitId, schema.coefficients.typeJournee], set });
  await journaliser(acteur, "coefficient", "modifier", { entiteId: produitId, avant: avant ? { type, perso: avant.valeurPerso, fige: avant.fige, mesure: avant.valeurMesuree } : null, apres: { type, ...v } });
}
