import { and, asc, desc, eq, gte, lte } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import type { ISODate } from "@/lib/dates";
import { chargerMoteur } from "./moteur";
import { derniersPrix, prixUnitaireComptage, stocksTheoriques } from "./stock";
import { relevesTemperatures } from "./taches";

/** CSV lisible par Excel en français : point-virgule, BOM UTF-8, virgule décimale. */
export function versCsv(entetes: string[], lignes: (string | number | null | undefined)[][]): string {
  const cell = (v: string | number | null | undefined) => {
    if (v === null || v === undefined) return "";
    const s = typeof v === "number" ? String(v).replace(".", ",") : String(v);
    return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return "﻿" + [entetes, ...lignes].map((l) => l.map(cell).join(";")).join("\r\n");
}

export async function exportStocks(): Promise<string> {
  const [charge, stocks, prixMap] = await Promise.all([chargerMoteur(), stocksTheoriques(), derniersPrix()]);
  const lignes = [...charge.articles.values()]
    .filter((a) => a.statut !== "archive")
    .sort((x, y) => (x.familleNom ?? "").localeCompare(y.familleNom ?? "", "fr") || x.nom.localeCompare(y.nom, "fr"))
    .map((a) => {
      const stock = stocks.get(a.id) ?? 0;
      const prix = prixUnitaireComptage(prixMap.get(a.id));
      return [a.nom, a.familleNom, a.nature, a.uniteComptage, Math.round(stock * 1000) / 1000, prix === null ? null : Math.round(prix * 100) / 100, prix === null ? null : Math.round(stock * prix * 100) / 100, a.structurant ? "oui" : "non", a.dlcJours];
    });
  return versCsv(["Article", "Famille", "Nature", "Unité", "Stock théorique", "Dernier prix HT", "Valeur", "Structurant", "DLC (jours)"], lignes);
}

export async function exportCommandes(debut: ISODate, fin: ISODate): Promise<string> {
  const rows = await db
    .select({ c: schema.commandes, l: schema.commandeLignes, fournisseur: schema.fournisseurs.nom, article: schema.articles.nom })
    .from(schema.commandeLignes)
    .innerJoin(schema.commandes, eq(schema.commandes.id, schema.commandeLignes.commandeId))
    .innerJoin(schema.fournisseurs, eq(schema.fournisseurs.id, schema.commandes.fournisseurId))
    .innerJoin(schema.articles, eq(schema.articles.id, schema.commandeLignes.articleId))
    .where(and(gte(schema.commandes.dateLivraison, debut), lte(schema.commandes.dateLivraison, fin)))
    .orderBy(desc(schema.commandes.dateLivraison), asc(schema.commandes.id));
  return versCsv(
    ["Commande", "Fournisseur", "Livraison", "Statut", "Envoyée le", "Article", "Qté proposée", "Qté commandée", "Qté (unité comptage)", "Qté reçue", "Prix estimé", "Origine"],
    rows.map((r) => [r.c.id, r.fournisseur, r.c.dateLivraison, r.c.statut, r.c.envoyeeLe?.toISOString() ?? null, r.article, Number(r.l.qteProposee), Number(r.l.qteCommandee), Number(r.l.qteComptage), Number(r.l.qteRecue), r.l.prixEstime === null ? null : Number(r.l.prixEstime), r.l.origine]),
  );
}

export async function exportReceptions(debut: ISODate, fin: ISODate): Promise<string> {
  const rows = await db
    .select({ r: schema.receptions, l: schema.receptionLignes, fournisseur: schema.fournisseurs.nom, article: schema.articles.nom, prenom: schema.personnes.prenom })
    .from(schema.receptionLignes)
    .innerJoin(schema.receptions, eq(schema.receptions.id, schema.receptionLignes.receptionId))
    .innerJoin(schema.fournisseurs, eq(schema.fournisseurs.id, schema.receptions.fournisseurId))
    .innerJoin(schema.articles, eq(schema.articles.id, schema.receptionLignes.articleId))
    .leftJoin(schema.personnes, eq(schema.personnes.id, schema.receptions.personneId))
    .where(and(gte(schema.receptions.date, debut), lte(schema.receptions.date, fin)))
    .orderBy(desc(schema.receptions.date), asc(schema.receptions.id));
  return versCsv(
    ["Réception", "Date", "Fournisseur", "Par", "Suppléant", "Achat direct", "Statut", "Décision", "Article", "Qté reçue", "Qté refusée", "Motif refus", "Qté commandée", "État", "Prix HT facture"],
    rows.map((r) => [r.r.id, r.r.date, r.fournisseur, r.prenom, r.r.parSuppleant ? "oui" : "non", r.r.achatDirect ? "oui" : "non", r.r.statut, r.r.decision, r.article, Number(r.l.qteRecue), Number(r.l.qteRefusee), r.l.motifRefus, r.l.qteCommandee === null ? null : Number(r.l.qteCommandee), r.l.etat, r.l.prixHt === null ? null : Number(r.l.prixHt)]),
  );
}

export async function exportPrix(): Promise<string> {
  const rows = await db
    .select({ p: schema.prix, article: schema.articles.nom, fournisseur: schema.fournisseurs.nom, unite: schema.articleFournisseurs.uniteCommande, qte: schema.articleFournisseurs.qteParUniteCommande })
    .from(schema.prix)
    .innerJoin(schema.articleFournisseurs, eq(schema.articleFournisseurs.id, schema.prix.articleFournisseurId))
    .innerJoin(schema.articles, eq(schema.articles.id, schema.articleFournisseurs.articleId))
    .innerJoin(schema.fournisseurs, eq(schema.fournisseurs.id, schema.articleFournisseurs.fournisseurId))
    .orderBy(asc(schema.articles.nom), desc(schema.prix.date));
  return versCsv(
    ["Article", "Fournisseur", "Unité de commande", "Unités de comptage par unité", "Prix HT", "TVA %", "Date"],
    rows.map((r) => [r.article, r.fournisseur, r.unite, Number(r.qte), Number(r.p.prixHt), Number(r.p.tvaPct), r.p.date]),
  );
}

export async function exportTaches(debut: ISODate, fin: ISODate): Promise<string> {
  const rows = await db
    .select({ t: schema.taches, poste: schema.postes.nom, prenom: schema.personnes.prenom })
    .from(schema.taches)
    .innerJoin(schema.postes, eq(schema.postes.id, schema.taches.posteId))
    .leftJoin(schema.personnes, eq(schema.personnes.id, schema.taches.faiteParPersonneId))
    .where(and(gte(schema.taches.journee, debut), lte(schema.taches.journee, fin)))
    .orderBy(asc(schema.taches.journee), asc(schema.taches.echeance));
  return versCsv(
    ["Journée", "Poste", "Tâche", "Échéance", "Statut", "Faite par", "Faite le", "Vérifiée le", "Commentaire", "Motif blocage", "Structurante", "Ponctuelle"],
    rows.map((r) => [r.t.journee, r.poste, r.t.titre, r.t.echeance.toISOString(), r.t.statut, r.prenom, r.t.faiteLe?.toISOString() ?? null, r.t.verifieeLe?.toISOString() ?? null, r.t.commentaireVerif, r.t.motifBlocage, r.t.structurante ? "oui" : "non", r.t.ponctuelle ? "oui" : "non"]),
  );
}

/** Relevé mensuel des températures, pièce demandée en cas de contrôle ONSSA. */
export async function exportTemperatures(debut: ISODate, fin: ISODate): Promise<string> {
  const rows = await relevesTemperatures(debut, fin);
  const lignes: (string | number | null)[][] = [];
  for (const r of rows) {
    for (const v of r.t.valeursSaisies) {
      lignes.push([r.t.journee, r.t.faiteLe?.toISOString() ?? null, r.poste, r.prenom, r.t.titre, v.label, v.valeur, v.horsPlage ? "HORS PLAGE" : "", r.t.statut]);
    }
  }
  return versCsv(["Journée", "Relevé le", "Poste", "Prénom", "Tâche", "Équipement", "Valeur", "Alerte", "Statut de la tâche"], lignes);
}
