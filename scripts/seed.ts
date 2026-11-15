/**
 * Chargement des données initiales (sections 14 et 15 du brief). Rejouable : les
 * enregistrements existants sont mis à jour par leur nom, rien n'est dupliqué, et les
 * valeurs déjà modifiées par les propriétaires (paramètres, coefficients personnalisés,
 * codes PIN) ne sont pas écrasées.
 *
 *   npm run db:seed
 */
import "dotenv/config";
import { and, eq } from "drizzle-orm";
import { db, schema, sql } from "../lib/db";
import { codeEnrolementAleatoire, hacherPin } from "../lib/auth/crypto";
import { estUnitePiece } from "../lib/services/moteur";
import { PARAMETRES_DEFAUT } from "../lib/services/parametres";
import {
  ARTICLES_ACHETES,
  FAMILLES_COMPTAGE,
  FAMILLES_PERTE,
  PREPARATIONS,
  PRODUITS,
  RECETTES,
  type ArticleInitial,
} from "../lib/donnees-initiales/moteur";
import { ARTICLES_HORS_VENTES, FOURNISSEURS, POSTES, TACHES } from "../lib/donnees-initiales/postes-taches";

const s = (n: number | null | undefined) => (n === null || n === undefined ? null : String(n));

async function main() {
  console.log("Paramètres…");
  for (const [cle, v] of Object.entries(PARAMETRES_DEFAUT)) {
    const valeur = cle === "code_enrolement" ? codeEnrolementAleatoire() : v.valeur;
    await db
      .insert(schema.parametres)
      .values({ cle, valeur, libelle: v.libelle, modifiePar: "données initiales" })
      .onConflictDoNothing();
  }

  console.log("Familles…");
  const familleId = new Map<string, number>();
  for (const [i, f] of FAMILLES_COMPTAGE.entries()) {
    const [row] = await db
      .insert(schema.familles)
      .values({ nom: f.nom, rythme: f.rythme, roleCompteur: f.role, joursSecurite: f.joursSecurite, ordre: i + 1 })
      .onConflictDoUpdate({ target: schema.familles.nom, set: { ordre: i + 1 } })
      .returning({ id: schema.familles.id });
    familleId.set(f.nom, row.id);
  }
  const perteId = new Map<string, number>();
  for (const f of FAMILLES_PERTE) {
    const [row] = await db
      .insert(schema.famillesPerte)
      .values({ nom: f.nom, pertePct: String(f.pertePct) })
      .onConflictDoUpdate({ target: schema.famillesPerte.nom, set: { nom: f.nom } })
      .returning({ id: schema.famillesPerte.id });
    perteId.set(f.nom, row.id);
  }

  console.log("Articles et préparations…");
  const articleId = new Map<string, number>();
  const upsertArticle = async (a: ArticleInitial) => {
    const valeurs = {
      nom: a.nom,
      nature: a.nature,
      familleId: familleId.get(a.famille) ?? null,
      famillePerteId: perteId.get(a.famillePerte ?? "Aucune") ?? null,
      uniteComptage: a.unite,
      poidsUnitaire: s(a.poidsUnitaire),
      unitePoids: a.unitePoids ?? null,
      structurant: a.structurant ?? false,
      dlcJours: a.dlc ?? null,
      rendementParage: s(a.rendement),
      lieAuxVentes: a.lieAuxVentes ?? true,
      stockMinimum: s(a.stockMinimum),
      stockCibleFixe: s(a.stockCible),
      partAvance: s(a.partAvance),
      rendementBatch: s(a.rendementBatch),
      uniteBatch: a.uniteBatch ?? null,
      coutRevient: s(a.coutRevient),
      critiqueCoutMatiere: a.critique ?? false,
      aConfirmer: a.aConfirmer ?? false,
      statut: "actif" as const,
    };
    const [existant] = await db.select({ id: schema.articles.id }).from(schema.articles).where(eq(schema.articles.nom, a.nom));
    if (existant) {
      // On ne réécrit que les champs structurels ; les réglages métier (DLC, pertes, avance) restent aux propriétaires.
      await db.update(schema.articles).set({ nature: valeurs.nature, familleId: valeurs.familleId, uniteComptage: valeurs.uniteComptage }).where(eq(schema.articles.id, existant.id));
      articleId.set(a.nom, existant.id);
      return;
    }
    const [row] = await db.insert(schema.articles).values(valeurs).returning({ id: schema.articles.id });
    articleId.set(a.nom, row.id);
  };
  for (const a of ARTICLES_ACHETES) await upsertArticle(a);
  for (const a of PREPARATIONS) await upsertArticle(a);
  for (const a of ARTICLES_HORS_VENTES) {
    await upsertArticle({
      nom: a.nom,
      nature: a.nature,
      unite: a.unite,
      famille: a.famille,
      famillePerte: "Aucune",
      estPiece: estUnitePiece(a.unite),
      lieAuxVentes: false,
      stockMinimum: a.stockMinimum,
      stockCible: a.stockCible,
      structurant: a.structurant,
      aConfirmer: true,
    });
  }

  console.log("Recettes…");
  for (const r of RECETTES) {
    const prep = articleId.get(r.preparation)!;
    for (const [ingredient, q] of r.ingredients) {
      const ing = articleId.get(ingredient);
      if (!ing) throw new Error(`Ingrédient inconnu : ${ingredient}`);
      await db
        .insert(schema.recetteLignes)
        .values({ preparationId: prep, ingredientId: ing, quantiteParBatch: String(q) })
        .onConflictDoNothing();
    }
  }

  console.log("Produits vendus, coefficients, nomenclature…");
  for (const [i, p] of PRODUITS.entries()) {
    const [row] = await db
      .insert(schema.produitsVendus)
      .values({ nom: p.nom, libellesCaisse: p.libellesCaisse ?? [p.nom], categorie: p.categorie, ordre: i + 1 })
      .onConflictDoUpdate({ target: schema.produitsVendus.nom, set: { ordre: i + 1, categorie: p.categorie } })
      .returning({ id: schema.produitsVendus.id });
    for (const type of ["semaine", "weekend"] as const) {
      await db
        .insert(schema.coefficients)
        .values({ produitId: row.id, typeJournee: type, valeurMesuree: String(p.coef[type]), periodeMesure: type === "semaine" ? "27-30 octobre 2026" : "24-25 octobre 2026" })
        .onConflictDoNothing();
    }
    for (const [article, q] of p.composants) {
      const aid = articleId.get(article);
      if (!aid) throw new Error(`Composant inconnu : ${article}`);
      await db
        .insert(schema.nomenclature)
        .values({ produitId: row.id, articleId: aid, quantite: String(q) })
        .onConflictDoNothing();
    }
  }

  console.log("Fournisseurs…");
  for (const f of FOURNISSEURS) {
    const [row] = await db
      .insert(schema.fournisseurs)
      .values({
        nom: f.nom,
        contact: f.contact ?? null,
        joursLivraison: f.joursLivraison,
        heureLimite: f.heureLimite ?? null,
        delaiJours: f.delaiJours ?? 1,
        validationRequise: f.validationRequise ?? false,
        achatDirect: f.achatDirect ?? false,
        statut: f.statut,
      })
      .onConflictDoUpdate({ target: schema.fournisseurs.nom, set: { achatDirect: f.achatDirect ?? false } })
      .returning({ id: schema.fournisseurs.id });
    for (const [article, uniteCommande, qte] of f.articles) {
      const aid = articleId.get(article);
      if (!aid) throw new Error(`Article inconnu pour ${f.nom} : ${article}`);
      await db
        .insert(schema.articleFournisseurs)
        .values({ articleId: aid, fournisseurId: row.id, uniteCommande, qteParUniteCommande: String(qte) })
        .onConflictDoNothing();
    }
  }

  console.log("Postes…");
  const posteId = new Map<string, number>();
  for (const p of POSTES) {
    const [existant] = await db.select({ id: schema.postes.id }).from(schema.postes).where(eq(schema.postes.nom, p.nom));
    if (existant) {
      posteId.set(p.nom, existant.id);
      continue;
    }
    const [row] = await db
      .insert(schema.postes)
      .values({
        nom: p.nom,
        role: p.role,
        zone: p.zone,
        pinHash: await hacherPin(p.pin),
        voitPreparations: p.voitPreparations ?? false,
        planNettoyage: p.planNettoyage ?? false,
        ordre: p.ordre,
      })
      .returning({ id: schema.postes.id });
    posteId.set(p.nom, row.id);
  }
  for (const p of POSTES) {
    if (!p.superieur) continue;
    await db.update(schema.postes).set({ posteSuperieurId: posteId.get(p.superieur) ?? null }).where(eq(schema.postes.id, posteId.get(p.nom)!));
  }

  console.log("Tâches récurrentes…");
  for (const t of TACHES) {
    const pid = posteId.get(t.poste);
    if (!pid) throw new Error(`Poste inconnu : ${t.poste}`);
    const [existant] = await db
      .select({ id: schema.tacheModeles.id })
      .from(schema.tacheModeles)
      .where(and(eq(schema.tacheModeles.titre, t.titre), eq(schema.tacheModeles.posteId, pid)));
    if (existant) continue;
    await db.insert(schema.tacheModeles).values({
      titre: t.titre,
      consigne: t.consigne ?? null,
      posteId: pid,
      recurrence: t.recurrence,
      joursSemaine: t.joursSemaine ?? [],
      heureCibleSemaine: t.heureSemaine,
      heureCibleWeekend: t.heureWeekend,
      delaiRemonteeMin: t.delaiRemonteeMin ?? 30,
      points: t.points ?? [],
      preuve: t.preuve,
      photosMin: t.photosMin ?? 1,
      valeurs: t.valeurs ?? [],
      structurante: t.structurante ?? false,
      ecranLie: t.ecranLie ?? null,
      familleId: t.famille ? familleId.get(t.famille) ?? null : null,
      ordre: t.ordre,
    });
  }

  const [code] = await db.select().from(schema.parametres).where(eq(schema.parametres.cle, "code_enrolement"));
  console.log("\nDonnées initiales chargées.");
  console.log(`Code d'enrôlement des appareils : ${code?.valeur}`);
  console.log("Codes PIN de départ (à changer dès la mise en service) :");
  for (const p of POSTES) console.log(`  ${p.nom.padEnd(30)} ${p.pin}`);
  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
