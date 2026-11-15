import { and, eq, gte, lte, desc, sql as dsql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { dateLongue, finJourneeExploitation, instantLocal, journeeExploitation, type ISODate } from "@/lib/dates";
import { fmtDH, fmtPct } from "@/lib/format";
import { creerAlerte } from "./alertes";
import { comptagesCritiquesDuJour } from "./comptages";
import { appliquerConsommationJour } from "./consommation";
import { journaliser, type Acteur } from "./journal";
import { chargerMoteur } from "./moteur";
import { chargerParametres, nombreDepuis } from "./parametres";
import { totalPertesDuJour, pertesEntre } from "./pertes";
import { chargerPrevisionniste } from "./previsions";
import { rupturesOuvertes } from "./ruptures";
import { derniersPrix, prixUnitaireComptage } from "./stock";
import { partTachesFaites, validerTacheLiee } from "./taches";

export interface CoutMatiere {
  date: ISODate;
  calculable: boolean;
  manque: string[];
  lignes: { nom: string; matin: number | null; receptions: number; soir: number | null; consomme: number | null; prix: number | null; cout: number | null; unite: string }[];
  total: number | null;
  caRealise: number | null;
  pct: number | null;
  cible: number;
  seuilAlerte: number;
  seuilCritique: number;
}

/**
 * Coût matière quotidien (fiche 07.4) sur les produits critiques :
 * (stock du matin + réceptions du jour − stock du soir) × dernier prix d'achat.
 * Le pain, fait sur place, est valorisé au coût de revient saisi par les propriétaires.
 */
export async function coutMatiereDuJour(date: ISODate): Promise<CoutMatiere> {
  const [charge, p, prixMap, { matin, soir }, [cloture]] = await Promise.all([
    chargerMoteur(),
    chargerParametres(),
    derniersPrix(),
    comptagesCritiquesDuJour(date),
    db.select().from(schema.cloturesJournee).where(eq(schema.cloturesJournee.date, date)),
  ]);
  const cible = nombreDepuis(p, "cout_matiere_cible");
  const seuilAlerte = cible + nombreDepuis(p, "cout_matiere_alerte_points");
  const seuilCritique = cible + nombreDepuis(p, "cout_matiere_critique_points");
  const critiques = [...charge.articles.values()].filter((a) => a.critique && a.statut !== "archive");
  const debut = instantLocal(date, "04:00");
  const finExploit = finJourneeExploitation(date);
  const receptionsRows = await db
    .select({ articleId: schema.mouvementsStock.articleId, total: dsql<string>`coalesce(sum(${schema.mouvementsStock.quantite}),0)` })
    .from(schema.mouvementsStock)
    .where(and(eq(schema.mouvementsStock.nature, "reception"), gte(schema.mouvementsStock.at, debut), lte(schema.mouvementsStock.at, finExploit)))
    .groupBy(schema.mouvementsStock.articleId);
  const receptions = new Map(receptionsRows.map((r) => [r.articleId, Number(r.total)]));
  const manque: string[] = [];
  const lignes: CoutMatiere["lignes"] = [];
  let total = 0;
  let calculable = critiques.length > 0;
  for (const a of critiques) {
    const m = matin.get(a.id) ?? null;
    const s = soir.get(a.id) ?? null;
    const r = receptions.get(a.id) ?? 0;
    const prix = a.nature === "preparation" ? a.coutRevient : prixUnitaireComptage(prixMap.get(a.id));
    if (m === null) manque.push(`${a.nom} : stock du matin`);
    if (s === null) manque.push(`${a.nom} : stock du soir`);
    if (prix === null) manque.push(`${a.nom} : prix d'achat`);
    const consomme = m !== null && s !== null ? m + r - s : null;
    const cout = consomme !== null && prix !== null ? consomme * prix : null;
    if (cout === null) calculable = false;
    else total += cout;
    lignes.push({ nom: a.nom, matin: m, receptions: r, soir: s, consomme, prix, cout, unite: a.uniteComptage });
  }
  const caRealise = cloture ? Number(cloture.caRealise) : null;
  const pct = calculable && caRealise ? total / caRealise : null;
  return { date, calculable, manque, lignes, total: calculable ? total : null, caRealise, pct, cible, seuilAlerte, seuilCritique };
}

export interface SaisieCloture {
  caRealise: number;
  caMidi?: number | null;
  caSoir?: number | null;
  couverts?: number | null;
  especes?: number | null;
  carte?: number | null;
  manquant?: number | null;
  faitMarquant?: string | null;
}

/** Clôture de journée : CA réalisé (ou import), consommation théorique, coût matière, rapport du soir. */
export async function cloturerJournee(acteur: Acteur, date: ISODate, s: SaisieCloture): Promise<{ rapport: string }> {
  const [existante] = await db.select().from(schema.cloturesJournee).where(eq(schema.cloturesJournee.date, date));
  const [importe] = await db.select({ id: schema.ventes.id }).from(schema.ventes).where(eq(schema.ventes.date, date)).limit(1);
  const source = importe ? "import" : "saisie";
  // Si un fichier de caisse est importé pour la journée, le CA vient du fichier.
  const caRealise = importe && existante ? Number(existante.caRealise) : s.caRealise;
  const valeurs = {
    caRealise: String(caRealise),
    caMidi: s.caMidi == null ? null : String(s.caMidi),
    caSoir: s.caSoir == null ? null : String(s.caSoir),
    couverts: s.couverts ?? null,
    especes: s.especes == null ? null : String(s.especes),
    carte: s.carte == null ? null : String(s.carte),
    manquant: s.manquant == null ? null : String(s.manquant),
    faitMarquant: s.faitMarquant?.trim() || null,
    source: source as "saisie" | "import",
    posteId: acteur.posteId,
    personneId: acteur.personneId,
    modifieLe: new Date(),
  };
  await db
    .insert(schema.cloturesJournee)
    .values({ date, ...valeurs })
    .onConflictDoUpdate({ target: schema.cloturesJournee.date, set: valeurs });
  await journaliser(acteur, "cloture", "cloturer", { entiteId: null, avant: existante ?? null, apres: { date, ...valeurs } });
  await appliquerConsommationJour(date);
  const rapport = await composerRapport(date);
  await db.update(schema.cloturesJournee).set({ rapport }).where(eq(schema.cloturesJournee.date, date));
  await alerterCoutMatiere(date);
  await validerTacheLiee(acteur, "cloture");
  return { rapport };
}

async function alerterCoutMatiere(date: ISODate): Promise<void> {
  const cm = await coutMatiereDuJour(date);
  if (cm.pct === null) return;
  if (cm.pct > cm.seuilAlerte) {
    await creerAlerte({
      type: "cout_matiere",
      niveau: cm.pct > cm.seuilCritique ? "critique" : "avertissement",
      titre: `Coût matière du ${dateLongue(date)} : ${fmtPct(cm.pct)}`,
      detail: `Cible ${fmtPct(cm.cible)}. Total ${fmtDH(cm.total)} pour un CA de ${fmtDH(cm.caRealise)}.`,
      objetType: "cloture",
      roles: ["proprietaire", "manager"],
      cleUnique: `cout_matiere:${date}`,
    });
  }
}

/** Rapport du soir : chiffres de clôture, coût matière, pertes, tâches non faites, ruptures. */
export async function composerRapport(date: ISODate): Promise<string> {
  const [[c], cm, pertesTotal, pertes, taches, ruptures, { pour }, p] = await Promise.all([
    db.select().from(schema.cloturesJournee).where(eq(schema.cloturesJournee.date, date)),
    coutMatiereDuJour(date),
    totalPertesDuJour(date),
    pertesEntre(date, date),
    partTachesFaites(date),
    rupturesOuvertes(),
    chargerPrevisionniste(),
    chargerParametres(),
  ]);
  const nonFaites = await db
    .select({ titre: schema.taches.titre, poste: schema.postes.nom, statut: schema.taches.statut })
    .from(schema.taches)
    .innerJoin(schema.postes, eq(schema.postes.id, schema.taches.posteId))
    .where(and(eq(schema.taches.journee, date), dsql`${schema.taches.statut} in ('a_faire','en_retard','bloquee','non_faite','a_refaire')`))
    .orderBy(desc(schema.taches.structurante));
  const prev = pour(date);
  const l: string[] = [];
  l.push(`Rapport ${p.nom_restaurant ?? "Easy Burger"} — ${dateLongue(date, true)}`);
  if (c) {
    l.push(`CA réalisé : ${fmtDH(c.caRealise)} (prévu ${fmtDH(prev.ca)}${prev.ca > 0 ? `, ${Number(c.caRealise) >= prev.ca ? "+" : ""}${(((Number(c.caRealise) - prev.ca) / prev.ca) * 100).toFixed(0)} %` : ""})`);
    if (c.caMidi !== null || c.caSoir !== null) l.push(`Midi ${fmtDH(c.caMidi)} · Soir ${fmtDH(c.caSoir)}`);
    if (c.couverts !== null) l.push(`Couverts : ${c.couverts}`);
    l.push(`Espèces ${fmtDH(c.especes)} · Carte ${fmtDH(c.carte)} · Manquant ${fmtDH(c.manquant)}`);
    if (c.faitMarquant) l.push(`Fait marquant : ${c.faitMarquant}`);
  } else {
    l.push("CA réalisé : non saisi");
  }
  l.push(cm.pct !== null ? `Coût matière : ${fmtPct(cm.pct)} (${fmtDH(cm.total)}, cible ${fmtPct(cm.cible)})` : `Coût matière : non calculable (${cm.manque.slice(0, 2).join(", ")}${cm.manque.length > 2 ? "…" : ""})`);
  l.push(`Pertes déclarées : ${fmtDH(pertesTotal)}${pertes.length > 0 ? ` (${pertes.map((x) => `${x.article} ${Number(x.p.quantite)} ${x.unite}`).join(", ")})` : ""}`);
  l.push(`Tâches : ${taches.faites}/${taches.total} faites`);
  if (nonFaites.length > 0) l.push(`Non faites : ${nonFaites.map((t) => `${t.titre} (${t.poste})`).join(" ; ")}`);
  l.push(ruptures.length > 0 ? `Ruptures en cours : ${ruptures.map((r) => r.article).join(", ")}` : "Aucune rupture en cours");
  return l.join("\n");
}

export function urlRapportWhatsApp(texte: string): string {
  return `https://wa.me/?text=${encodeURIComponent(texte)}`;
}

export async function clotureDuJour(date: ISODate = journeeExploitation()) {
  const [c] = await db.select().from(schema.cloturesJournee).where(eq(schema.cloturesJournee.date, date));
  return c ?? null;
}

export async function chiffresDeLaVeille(date: ISODate) {
  const [[c], cm, pertes, taches, { pour }] = await Promise.all([
    db.select().from(schema.cloturesJournee).where(eq(schema.cloturesJournee.date, date)),
    coutMatiereDuJour(date),
    totalPertesDuJour(date),
    partTachesFaites(date),
    chargerPrevisionniste(),
  ]);
  return { date, prevu: pour(date).ca, realise: c ? Number(c.caRealise) : null, coutMatierePct: cm.pct, coutMatiere: cm.total, pertes, taches };
}
