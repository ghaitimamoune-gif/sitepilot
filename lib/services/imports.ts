import { and, desc, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import type { ISODate } from "@/lib/dates";
import { LIBELLES_RETIRES } from "@/lib/donnees-initiales/moteur";
import { analyserRapportDetaille, analyserVentesParProduit, construireCorrespondance, type AnalyseRapport } from "@/lib/import/caisse";
import { lireRapportDetaille } from "@/lib/import/classeur";
import { creerAlerte } from "./alertes";
import { appliquerConsommationJour } from "./consommation";
import { proposerDepuisPeriode } from "./coefficients";
import { journaliser, type Acteur } from "./journal";
import type { TypeJournee } from "@/lib/engine/types";

export async function tableCorrespondance(): Promise<Map<string, number>> {
  const produits = await db.select().from(schema.produitsVendus);
  return construireCorrespondance(produits);
}

export interface ResultatImport {
  importId: number;
  jours: { date: ISODate; total: number }[];
  total: number;
  lignes: number;
  lignesIgnorees: number;
  inconnus: { libelle: string; quantite: number; montant: number }[];
}

/** Analyse sans écriture, pour l'aperçu avant import. */
export async function analyserRapport(contenu: Buffer, totalAttendu: number | null = null): Promise<AnalyseRapport> {
  const lu = await lireRapportDetaille(contenu);
  const corr = await tableCorrespondance();
  return analyserRapportDetaille(lu.lignes, totalAttendu ?? lu.totalSynthese, corr, LIBELLES_RETIRES);
}

/**
 * Import du rapport détaillé : le CA et le détail par produit viennent du fichier,
 * la saisie manuelle du CA disparaît pour ces journées, la consommation théorique est recalculée.
 * Un libellé inconnu bloque sa ligne (ses unités ne sont pas comptées) et est signalé aux propriétaires.
 */
export async function importerRapportDetaille(acteur: Acteur, contenu: Buffer, nomFichier: string, totalAttendu: number | null = null): Promise<ResultatImport> {
  const analyse = await analyserRapport(contenu, totalAttendu);
  if (analyse.totalSynthese === null && totalAttendu === null) {
    throw new Error("Total de contrôle introuvable dans la feuille SYNTHESE : saisissez le CA TTC de la période pour confirmer.");
  }
  if (!analyse.ok) throw new Error(analyse.erreur ?? "Import refusé.");
  const dates = [...analyse.parJour.keys()].sort();
  const importId = await db.transaction(async (tx) => {
    // Un nouveau fichier pour les mêmes journées remplace les lignes précédentes (journalisé).
    const anciens = await tx
      .select({ importId: schema.ventes.importId })
      .from(schema.ventes)
      .where(inArray(schema.ventes.date, dates))
      .groupBy(schema.ventes.importId);
    if (anciens.length > 0) {
      await tx.delete(schema.ventes).where(inArray(schema.ventes.date, dates));
      await journaliser(acteur, "import_ventes", "remplacer_lignes", { apres: { dates, anciensImports: anciens.map((a) => a.importId) }, tx });
    }
    const [imp] = await tx
      .insert(schema.importsVentes)
      .values({
        fichier: nomFichier,
        format: "detaille",
        dateDebut: dates[0],
        dateFin: dates[dates.length - 1],
        total: String(analyse.total),
        lignes: analyse.lignes.length,
        lignesIgnorees: analyse.nbIgnorees,
        posteId: acteur.posteId,
        personneId: acteur.personneId,
      })
      .returning({ id: schema.importsVentes.id });
    const valeurs = analyse.lignes
      .filter((l) => l.statut !== "option")
      .map((l) => ({
        importId: imp.id,
        date: l.date,
        heure: l.heure,
        ticket: l.ticket,
        categorie: l.categorie,
        libelle: l.libelle,
        produitId: l.statut === "produit" ? l.produitId : null,
        quantite: String(l.quantite),
        montant: String(l.montant),
        typeVente: l.statut === "menu" ? "menu" : l.statut === "inconnu" ? "inconnu" : l.typeVente,
      }));
    for (let i = 0; i < valeurs.length; i += 500) await tx.insert(schema.ventes).values(valeurs.slice(i, i + 500));
    for (const d of dates) {
      const total = analyse.parJour.get(d) ?? 0;
      await tx
        .insert(schema.cloturesJournee)
        .values({ date: d, caRealise: String(total), source: "import", posteId: acteur.posteId, personneId: acteur.personneId, modifieLe: new Date() })
        .onConflictDoUpdate({ target: schema.cloturesJournee.date, set: { caRealise: String(total), source: "import", modifieLe: new Date() } });
    }
    await journaliser(acteur, "import_ventes", "importer", { entiteId: imp.id, apres: { fichier: nomFichier, dates, total: analyse.total }, tx });
    return imp.id;
  });
  for (const d of dates) await appliquerConsommationJour(d);
  const inconnus = [...analyse.inconnus.entries()].map(([libelle, v]) => ({ libelle, ...v }));
  if (inconnus.length > 0) {
    await creerAlerte({
      type: "import_libelle_inconnu",
      niveau: "a_traiter",
      titre: `${inconnus.length} libellé(s) de caisse inconnu(s)`,
      detail: inconnus.map((i) => `${i.libelle} (${i.quantite} unités, ${i.montant.toFixed(0)} DH)`).join(" ; ") + ". Rattachez-les à un produit dans Paramètres → Produits, ou corrigez la caisse.",
      objetType: "import",
      objetId: importId,
      roles: ["proprietaire"],
    });
  }
  return {
    importId,
    jours: dates.map((d) => ({ date: d, total: analyse.parJour.get(d) ?? 0 })),
    total: analyse.total,
    lignes: analyse.lignes.length,
    lignesIgnorees: analyse.nbIgnorees,
    inconnus,
  };
}

/** Format 2 : utilisable pour les coefficients, pas pour le stock quotidien. */
export async function importerVentesParProduit(
  acteur: Acteur,
  texte: string,
  nomFichier: string,
  options: { periode: string; caPeriode: number; type: TypeJournee },
): Promise<{ importId: number; propositions: number; inconnus: string[] }> {
  const corr = await tableCorrespondance();
  const lignes = analyserVentesParProduit(texte, corr, LIBELLES_RETIRES);
  if (lignes.length === 0) throw new Error("Aucune ligne lisible (colonnes attendues : Produit;Détail;Quantité;Tickets;Montant).");
  const total = lignes.reduce((s, l) => s + l.montant, 0);
  const [imp] = await db
    .insert(schema.importsVentes)
    .values({ fichier: nomFichier, format: "produits", total: String(total), lignes: lignes.length, posteId: acteur.posteId, personneId: acteur.personneId })
    .returning({ id: schema.importsVentes.id });
  const propositions = await proposerDepuisPeriode(
    acteur,
    lignes.filter((l) => l.statut === "produit" && l.produitId !== null).map((l) => ({ produitId: l.produitId!, quantite: l.quantite })),
    options.caPeriode,
    options.periode,
    options.type,
  );
  const inconnus = lignes.filter((l) => l.statut === "inconnu").map((l) => l.libelle);
  if (inconnus.length > 0) {
    await creerAlerte({
      type: "import_libelle_inconnu",
      niveau: "a_traiter",
      titre: `${inconnus.length} libellé(s) inconnu(s) dans le fichier par produit`,
      detail: inconnus.join(" ; "),
      objetType: "import",
      objetId: imp.id,
      roles: ["proprietaire"],
    });
  }
  return { importId: imp.id, propositions, inconnus };
}

export async function listerImports(limite = 20) {
  return db.select().from(schema.importsVentes).orderBy(desc(schema.importsVentes.creeLe)).limit(limite);
}

/** Libellés inconnus encore présents dans les ventes importées (pour l'écran de rattachement). */
export async function libellesInconnus(): Promise<{ libelle: string; quantite: number; montant: number }[]> {
  const rows = await db
    .select({ libelle: schema.ventes.libelle, quantite: schema.ventes.quantite, montant: schema.ventes.montant })
    .from(schema.ventes)
    .where(and(eq(schema.ventes.typeVente, "inconnu")));
  const m = new Map<string, { quantite: number; montant: number }>();
  for (const r of rows) {
    const v = m.get(r.libelle) ?? { quantite: 0, montant: 0 };
    v.quantite += Number(r.quantite);
    v.montant += Number(r.montant);
    m.set(r.libelle, v);
  }
  return [...m.entries()].map(([libelle, v]) => ({ libelle, ...v })).sort((a, b) => b.montant - a.montant);
}

/** Rattache un libellé de caisse à un produit, et répare les ventes déjà importées sous ce libellé. */
export async function rattacherLibelle(acteur: Acteur, libelle: string, produitId: number): Promise<number> {
  const [p] = await db.select().from(schema.produitsVendus).where(eq(schema.produitsVendus.id, produitId));
  if (!p) throw new Error("Produit introuvable.");
  if (!p.libellesCaisse.includes(libelle)) {
    await db.update(schema.produitsVendus).set({ libellesCaisse: [...p.libellesCaisse, libelle] }).where(eq(schema.produitsVendus.id, produitId));
  }
  const rows = await db
    .update(schema.ventes)
    .set({ produitId, typeVente: null })
    .where(and(eq(schema.ventes.libelle, libelle), eq(schema.ventes.typeVente, "inconnu")))
    .returning({ date: schema.ventes.date });
  const dates = [...new Set(rows.map((r) => r.date))];
  for (const d of dates) await appliquerConsommationJour(d);
  await journaliser(acteur, "produit_vendu", "rattacher_libelle", { entiteId: produitId, apres: { libelle, lignes: rows.length } });
  return rows.length;
}
