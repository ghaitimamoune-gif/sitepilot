import { and, asc, desc, eq, gte, inArray, lt, lte, ne, or, sql as dsql } from "drizzle-orm";
import { db, schema, type Tx } from "@/lib/db";
import {
  ajouterJours,
  finJourneeExploitation,
  instantLocal,
  journeeExploitation,
  jourSemaine,
  premierJourDuMois,
  type ISODate,
} from "@/lib/dates";
import { dansPerimetre, roleRemontee, type PosteMinimal, type Role } from "@/lib/auth/droits";
import type { ValeurAttendue, ValeurSaisie } from "@/lib/db/schema";
import { creerAlerte } from "./alertes";
import { chargerCalendrier } from "./calendrier";
import { journaliser, type Acteur } from "./journal";
import { chargerParametres, nombreDepuis } from "./parametres";
import { compterPhotos } from "./photos";

export type StatutTache = (typeof schema.statutTacheEnum.enumValues)[number];
export type Tache = typeof schema.taches.$inferSelect;

export const LIBELLE_STATUT: Record<StatutTache, string> = {
  a_faire: "À faire",
  faite: "Faite",
  verifiee: "Vérifiée",
  a_refaire: "À refaire",
  bloquee: "Bloquée",
  en_retard: "En retard",
  non_faite: "Non faite",
  annulee: "Annulée",
};

const STATUTS_OUVERTS: StatutTache[] = ["a_faire", "a_refaire", "en_retard", "bloquee"];

// ---------------------------------------------------------------------------
// Génération des tâches récurrentes
// ---------------------------------------------------------------------------

function modeleDuCeJour(m: typeof schema.tacheModeles.$inferSelect, date: ISODate, premierOuvertDuMois: ISODate): boolean {
  const js = jourSemaine(date);
  switch (m.recurrence) {
    case "chaque_jour_ouvert":
      return true;
    case "jours_semaine":
    case "hebdomadaire":
      return m.joursSemaine.includes(js);
    case "mensuelle":
      if (m.jourDuMois) return Number(date.slice(8, 10)) === m.jourDuMois;
      return date === premierOuvertDuMois;
    default:
      return false;
  }
}

/** Crée les tâches récurrentes d'une journée ouverte à partir des modèles. Rejouable. */
export async function genererTachesDuJour(date: ISODate = journeeExploitation()): Promise<number> {
  const cal = await chargerCalendrier();
  if (!cal.estOuvert(date)) return 0;
  const type = cal.typeJournee(date);
  const premierOuvertDuMois = cal.joursOuverts(premierJourDuMois(date), 1)[0];
  const modeles = await db
    .select()
    .from(schema.tacheModeles)
    .innerJoin(schema.postes, eq(schema.postes.id, schema.tacheModeles.posteId))
    .where(and(eq(schema.tacheModeles.actif, true), eq(schema.postes.actif, true), ne(schema.tacheModeles.recurrence, "ponctuelle")));
  let n = 0;
  for (const { tache_modeles: m } of modeles) {
    if (!modeleDuCeJour(m, date, premierOuvertDuMois)) continue;
    const heure = type === "weekend" ? m.heureCibleWeekend : m.heureCibleSemaine;
    const res = await db
      .insert(schema.taches)
      .values({
        modeleId: m.id,
        posteId: m.posteId,
        journee: date,
        echeance: instantLocal(date, heure),
        delaiRemonteeMin: m.delaiRemonteeMin,
        titre: m.titre,
        consigne: m.consigne,
        points: m.points,
        pointsCoches: m.points.map(() => false),
        preuve: m.preuve,
        photosMin: m.preuve === "photos" ? Math.max(1, m.photosMin) : 0,
        valeurs: m.valeurs,
        valeursSaisies: m.valeurs.map((v) => ({ label: v.label, valeur: null })),
        structurante: m.structurante,
        ecranLie: m.ecranLie,
        familleId: m.familleId,
        ponctuelle: false,
      })
      .onConflictDoNothing()
      .returning({ id: schema.taches.id });
    if (res.length > 0) n++;
  }
  return n;
}

// ---------------------------------------------------------------------------
// Lecture
// ---------------------------------------------------------------------------

export async function tachesDuPoste(posteId: number, journee: ISODate = journeeExploitation()) {
  return db
    .select()
    .from(schema.taches)
    .where(and(eq(schema.taches.posteId, posteId), eq(schema.taches.journee, journee), ne(schema.taches.statut, "annulee")))
    .orderBy(asc(schema.taches.echeance), asc(schema.taches.id));
}

export async function tache(id: number): Promise<Tache | null> {
  const [t] = await db.select().from(schema.taches).where(eq(schema.taches.id, id));
  return t ?? null;
}

export async function postesActifs(): Promise<(typeof schema.postes.$inferSelect)[]> {
  return db.select().from(schema.postes).where(eq(schema.postes.actif, true)).orderBy(asc(schema.postes.ordre), asc(schema.postes.nom));
}

function versMinimal(p: typeof schema.postes.$inferSelect): PosteMinimal {
  return { id: p.id, role: p.role, zone: p.zone, posteSuperieurId: p.posteSuperieurId };
}

/** Postes pour lesquels un acteur peut créer ou vérifier des tâches. */
export async function postesDuPerimetre(acteur: typeof schema.postes.$inferSelect | PosteMinimal) {
  const tous = await postesActifs();
  const a: PosteMinimal = "zone" in acteur ? { id: acteur.id, role: acteur.role, zone: acteur.zone, posteSuperieurId: acteur.posteSuperieurId } : acteur;
  return tous.filter((p) => dansPerimetre(a, versMinimal(p)));
}

/**
 * Tâches de l'équipe pour un responsable : celles de ses postes aujourd'hui, avec
 * en tête les tâches remontées (en retard, bloquées) et celles à vérifier (faites).
 */
export async function tachesDeLEquipe(acteur: PosteMinimal, journee: ISODate = journeeExploitation()) {
  const perimetre = await postesDuPerimetre(acteur);
  const ids = perimetre.map((p) => p.id);
  if (ids.length === 0) return { postes: perimetre, taches: [] as Tache[] };
  const rows = await db
    .select()
    .from(schema.taches)
    .where(
      and(
        inArray(schema.taches.posteId, ids),
        or(eq(schema.taches.journee, journee), inArray(schema.taches.statut, ["en_retard", "bloquee", "faite"])),
        ne(schema.taches.statut, "annulee"),
        gte(schema.taches.journee, ajouterJours(journee, -7)),
      ),
    )
    .orderBy(asc(schema.taches.echeance));
  const poids: Record<StatutTache, number> = { bloquee: 0, en_retard: 1, faite: 2, a_refaire: 3, a_faire: 4, non_faite: 5, verifiee: 6, annulee: 7 };
  rows.sort((x, y) => poids[x.statut] - poids[y.statut] || x.echeance.getTime() - y.echeance.getTime());
  return { postes: perimetre, taches: rows };
}

/** Tâches remontées jusqu'à un rôle (pour la manager et les propriétaires). */
export async function tachesRemonteesPour(role: Role, journee: ISODate = journeeExploitation()) {
  const postes = await postesActifs();
  const concernes = postes.filter((p) => roleRemontee(versMinimal(p)) === role).map((p) => p.id);
  const cond = [
    inArray(schema.taches.statut, ["en_retard", "bloquee", "non_faite"]),
    gte(schema.taches.journee, ajouterJours(journee, -3)),
  ];
  const parPoste = concernes.length > 0 ? inArray(schema.taches.posteId, concernes) : dsql`false`;
  const where = role === "proprietaire" ? and(...cond, or(parPoste, eq(schema.taches.structurante, true))) : and(...cond, parPoste);
  return db.select().from(schema.taches).where(where).orderBy(desc(schema.taches.echeance)).limit(50);
}

// ---------------------------------------------------------------------------
// Côté poste
// ---------------------------------------------------------------------------

async function exigerTacheDuPoste(tacheId: number, posteId: number): Promise<Tache> {
  const t = await tache(tacheId);
  if (!t || t.posteId !== posteId) throw new Error("Cette tâche n'appartient pas à votre poste.");
  return t;
}

export async function cocherPoint(acteur: Acteur, tacheId: number, index: number, coche: boolean): Promise<void> {
  const t = await exigerTacheDuPoste(tacheId, acteur.posteId!);
  if (!STATUTS_OUVERTS.includes(t.statut)) return;
  const points = [...t.pointsCoches];
  while (points.length < t.points.length) points.push(false);
  points[index] = coche;
  await db.update(schema.taches).set({ pointsCoches: points }).where(eq(schema.taches.id, tacheId));
}

export async function saisirValeurs(acteur: Acteur, tacheId: number, valeurs: (number | null)[]): Promise<{ horsPlage: string[] }> {
  const t = await exigerTacheDuPoste(tacheId, acteur.posteId!);
  if (!STATUTS_OUVERTS.includes(t.statut)) return { horsPlage: [] };
  const attendues: ValeurAttendue[] = t.valeurs;
  const saisies: ValeurSaisie[] = attendues.map((a, i) => {
    const v = valeurs[i] ?? null;
    const horsPlage =
      v !== null && ((a.min !== null && a.min !== undefined && v < a.min) || (a.max !== null && a.max !== undefined && v > a.max));
    return { label: a.label, valeur: v, horsPlage };
  });
  await db.update(schema.taches).set({ valeursSaisies: saisies }).where(eq(schema.taches.id, tacheId));
  const horsPlage = saisies.filter((s) => s.horsPlage).map((s) => `${s.label} : ${s.valeur}`);
  if (horsPlage.length > 0) {
    // Une valeur hors plage remonte immédiatement à la manager, avec la consigne du manuel.
    await creerAlerte({
      type: "temperature",
      niveau: "critique",
      titre: `Valeur hors plage : ${t.titre}`,
      detail: `${horsPlage.join(" ; ")}. Consigne : ne rien jeter, ne rien utiliser, prévenir la manager.`,
      objetType: "tache",
      objetId: tacheId,
      roles: ["manager", "proprietaire"],
      cleUnique: `temperature:${tacheId}:${horsPlage.length}`,
    });
    await journaliser(acteur, "tache", "valeur_hors_plage", { entiteId: tacheId, apres: { horsPlage } });
  }
  return { horsPlage };
}

export interface PreuveManquante {
  points: number;
  photos: number;
  valeurs: number;
}

export async function preuveManquante(t: Tache): Promise<PreuveManquante> {
  const pointsManquants = t.points.filter((_, i) => !t.pointsCoches[i]).length;
  let photosManquantes = 0;
  if (t.preuve === "photos") {
    const n = (await compterPhotos("tache", [t.id])).get(t.id) ?? 0;
    photosManquantes = Math.max(0, t.photosMin - n);
  }
  let valeursManquantes = 0;
  if (t.preuve === "valeurs") {
    const saisies: ValeurSaisie[] = t.valeursSaisies;
    valeursManquantes = t.valeurs.filter((_, i) => saisies[i]?.valeur === null || saisies[i]?.valeur === undefined).length;
  }
  return { points: pointsManquants, photos: photosManquantes, valeurs: valeursManquantes };
}

/** « C'est fait » : seulement si la preuve demandée est complète. */
export async function terminerTache(acteur: Acteur, tacheId: number): Promise<{ ok: true } | { ok: false; erreur: string }> {
  const t = await exigerTacheDuPoste(tacheId, acteur.posteId!);
  if (!STATUTS_OUVERTS.includes(t.statut)) return { ok: false, erreur: "Cette tâche n'est plus à faire." };
  const m = await preuveManquante(t);
  if (m.points > 0) return { ok: false, erreur: `${m.points} point${m.points > 1 ? "s" : ""} à cocher.` };
  if (m.photos > 0) return { ok: false, erreur: `${m.photos} photo${m.photos > 1 ? "s" : ""} manquante${m.photos > 1 ? "s" : ""}.` };
  if (m.valeurs > 0) return { ok: false, erreur: `${m.valeurs} valeur${m.valeurs > 1 ? "s" : ""} à saisir.` };
  await db
    .update(schema.taches)
    .set({ statut: "faite", faiteParPersonneId: acteur.personneId, faiteLe: new Date(), motifBlocage: null })
    .where(eq(schema.taches.id, tacheId));
  await journaliser(acteur, "tache", "faire", { entiteId: tacheId, avant: { statut: t.statut }, apres: { statut: "faite" } });
  return { ok: true };
}

/** « Bloquée » : motif obligatoire, remontée immédiate. */
export async function bloquerTache(acteur: Acteur, tacheId: number, motif: string): Promise<void> {
  const t = await exigerTacheDuPoste(tacheId, acteur.posteId!);
  if (!STATUTS_OUVERTS.includes(t.statut)) return;
  if (!motif.trim()) throw new Error("Le motif est obligatoire.");
  await db.update(schema.taches).set({ statut: "bloquee", motifBlocage: motif.trim() }).where(eq(schema.taches.id, tacheId));
  await journaliser(acteur, "tache", "bloquer", { entiteId: tacheId, apres: { motif } });
  await remonterTache({ ...t, statut: "bloquee", motifBlocage: motif });
}

/** Terminer une action dans l'écran lié valide la tâche correspondante du jour. */
export async function validerTacheLiee(acteur: Acteur, ecran: string, familleId?: number | null): Promise<void> {
  const journee = journeeExploitation();
  const ecranLie = ecran === "comptage_fermeture" ? "comptage" : ecran;
  const rows = await db
    .select()
    .from(schema.taches)
    .where(
      and(
        eq(schema.taches.posteId, acteur.posteId!),
        eq(schema.taches.journee, journee),
        eq(schema.taches.ecranLie, ecranLie as (typeof schema.ecranLieEnum.enumValues)[number]),
        inArray(schema.taches.statut, STATUTS_OUVERTS),
      ),
    );
  for (const t of rows) {
    if (ecranLie === "comptage" && familleId && t.familleId && t.familleId !== familleId) continue;
    if (ecran === "comptage_fermeture" && !/fermeture/i.test(t.titre)) continue;
    if (ecran === "comptage" && /fermeture/i.test(t.titre)) continue;
    await db
      .update(schema.taches)
      .set({ statut: "faite", faiteParPersonneId: acteur.personneId, faiteLe: new Date(), pointsCoches: t.points.map(() => true) })
      .where(eq(schema.taches.id, t.id));
    await journaliser(acteur, "tache", "faire_par_ecran", { entiteId: t.id, apres: { ecran } });
  }
}

// ---------------------------------------------------------------------------
// Côté responsable
// ---------------------------------------------------------------------------

export async function verifierTache(acteur: Acteur, acteurPoste: PosteMinimal, tacheId: number, ok: boolean, commentaire: string | null): Promise<void> {
  const t = await tache(tacheId);
  if (!t) throw new Error("Tâche introuvable.");
  const [cible] = await db.select().from(schema.postes).where(eq(schema.postes.id, t.posteId));
  if (!cible || !dansPerimetre(acteurPoste, versMinimal(cible))) throw new Error("Ce poste n'est pas dans votre périmètre.");
  if (t.statut !== "faite") throw new Error("Seule une tâche faite se vérifie.");
  if (!ok && !commentaire?.trim()) throw new Error("Un commentaire est demandé pour renvoyer une tâche.");
  await db
    .update(schema.taches)
    .set({
      statut: ok ? "verifiee" : "a_refaire",
      verifieeParPersonneId: acteur.personneId,
      verifieeLe: new Date(),
      commentaireVerif: commentaire?.trim() || null,
      pointsCoches: ok ? t.pointsCoches : t.points.map(() => false),
    })
    .where(eq(schema.taches.id, tacheId));
  await journaliser(acteur, "tache", ok ? "verifier" : "renvoyer", { entiteId: tacheId, apres: { commentaire } });
}

export interface NouvelleTachePonctuelle {
  posteId: number;
  titre: string;
  consigne?: string | null;
  journee?: ISODate;
  heure?: string;
  preuve: "aucune" | "photos" | "valeurs";
  photosMin?: number;
  valeurs?: ValeurAttendue[];
  points?: string[];
  structurante?: boolean;
  delaiRemonteeMin?: number;
}

export async function creerTachePonctuelle(acteur: Acteur, acteurPoste: PosteMinimal, n: NouvelleTachePonctuelle, tx?: Tx): Promise<number> {
  const ex = tx ?? db;
  const [cible] = await ex.select().from(schema.postes).where(eq(schema.postes.id, n.posteId));
  if (!cible) throw new Error("Poste introuvable.");
  if (cible.id !== acteurPoste.id && !dansPerimetre(acteurPoste, versMinimal(cible))) {
    throw new Error("Ce poste n'est pas dans votre périmètre.");
  }
  if (!n.titre.trim()) throw new Error("Le titre est obligatoire.");
  const p = await chargerParametres();
  const journee = n.journee ?? journeeExploitation();
  const echeance = n.heure ? instantLocal(journee, n.heure) : new Date();
  const valeurs = n.valeurs ?? [];
  const [t] = await ex
    .insert(schema.taches)
    .values({
      posteId: n.posteId,
      journee,
      echeance,
      delaiRemonteeMin: n.delaiRemonteeMin ?? nombreDepuis(p, "delai_remontee_defaut"),
      titre: n.titre.trim(),
      consigne: n.consigne?.trim() || null,
      points: n.points ?? [],
      pointsCoches: (n.points ?? []).map(() => false),
      preuve: n.preuve,
      photosMin: n.preuve === "photos" ? Math.max(1, n.photosMin ?? 1) : 0,
      valeurs,
      valeursSaisies: valeurs.map((v) => ({ label: v.label, valeur: null })),
      structurante: n.structurante ?? false,
      ponctuelle: true,
      creeParPosteId: acteur.posteId,
      creeParPersonneId: acteur.personneId,
    })
    .returning({ id: schema.taches.id });
  await journaliser(acteur, "tache", "creer", { entiteId: t.id, apres: { posteId: n.posteId, titre: n.titre }, tx });
  return t.id;
}

/** Seul le créateur d'une tâche ponctuelle, ou un propriétaire, l'annule. */
export async function annulerTache(acteur: Acteur, role: Role, tacheId: number): Promise<void> {
  const t = await tache(tacheId);
  if (!t) return;
  if (role !== "proprietaire" && t.creeParPosteId !== acteur.posteId) throw new Error("Seul le créateur ou un propriétaire annule cette tâche.");
  await db.update(schema.taches).set({ statut: "annulee" }).where(eq(schema.taches.id, tacheId));
  await journaliser(acteur, "tache", "annuler", { entiteId: tacheId, avant: { statut: t.statut } });
}

// ---------------------------------------------------------------------------
// Remontée par strates et fin de journée
// ---------------------------------------------------------------------------

/**
 * Une tâche remontée s'affiche en tête de l'écran du supérieur (voir tachesRemonteesPour).
 * Seule une tâche structurante crée en plus une alerte, adressée aux propriétaires
 * (tableau des alertes, section 11 du brief).
 */
async function remonterTache(t: Tache): Promise<void> {
  const [poste] = await db.select().from(schema.postes).where(eq(schema.postes.id, t.posteId));
  if (!poste) return;
  await db
    .update(schema.taches)
    .set({ remonteeNiveau: Math.max(1, t.remonteeNiveau), remonteeLe: new Date() })
    .where(eq(schema.taches.id, t.id));
  if (!t.structurante) return;
  const retardMin = Math.max(0, Math.round((Date.now() - t.echeance.getTime()) / 60000));
  await creerAlerte({
    type: "tache_structurante",
    niveau: "critique",
    titre: `${t.statut === "bloquee" ? "Tâche structurante bloquée" : "Tâche structurante en retard"} : ${t.titre}`,
    detail: `${poste.nom} — ${t.statut === "bloquee" ? `bloquée : ${t.motifBlocage ?? ""}` : `en retard de ${retardMin} min`}`,
    objetType: "tache",
    objetId: t.id,
    roles: ["proprietaire"],
    cleUnique: `tache:${t.id}:${t.statut}`,
  });
}

/** Nombre de tâches remontées jusqu'à un rôle (compteur de l'onglet « Équipe »). */
export async function compterRemontees(role: Role, journee: ISODate = journeeExploitation()): Promise<number> {
  const rows = await tachesRemonteesPour(role, journee);
  return rows.filter((t) => t.statut === "en_retard" || t.statut === "bloquee").length;
}

/** Passe en retard les tâches dont l'heure cible plus le délai est dépassée, et les remonte. */
export async function remonterTachesEnRetard(maintenant = new Date()): Promise<number> {
  const rows = await db
    .select()
    .from(schema.taches)
    .where(
      and(
        inArray(schema.taches.statut, ["a_faire", "a_refaire"]),
        lt(dsql`${schema.taches.echeance} + make_interval(mins => ${schema.taches.delaiRemonteeMin})`, maintenant.toISOString()),
        gte(schema.taches.journee, ajouterJours(journeeExploitation(maintenant), -2)),
      ),
    );
  for (const t of rows) {
    await db.update(schema.taches).set({ statut: "en_retard" }).where(eq(schema.taches.id, t.id));
    await remonterTache({ ...t, statut: "en_retard" });
  }
  return rows.length;
}

/**
 * Fin de la journée d'exploitation : une tâche récurrente non faite passe à « non faite » ;
 * une tâche ponctuelle se reporte au prochain jour ouvert.
 */
export async function cloreJourneeTaches(journee: ISODate, maintenant = new Date()): Promise<void> {
  if (maintenant < finJourneeExploitation(journee)) return;
  const cal = await chargerCalendrier();
  const suivant = cal.prochainJourOuvert(journee);
  const rows = await db
    .select()
    .from(schema.taches)
    .where(and(lte(schema.taches.journee, journee), inArray(schema.taches.statut, STATUTS_OUVERTS)));
  for (const t of rows) {
    if (t.ponctuelle) {
      await db
        .update(schema.taches)
        .set({ journee: suivant, echeance: instantLocal(suivant, "09:00"), statut: t.statut === "bloquee" ? "bloquee" : "a_faire", reporteeDe: t.reporteeDe ?? t.id })
        .where(eq(schema.taches.id, t.id));
    } else {
      await db.update(schema.taches).set({ statut: "non_faite" }).where(eq(schema.taches.id, t.id));
      if (t.structurante) {
        const [poste] = await db.select().from(schema.postes).where(eq(schema.postes.id, t.posteId));
        await creerAlerte({
          type: "tache_structurante",
          niveau: "critique",
          titre: `Tâche structurante non faite : ${t.titre}`,
          detail: `${poste?.nom ?? "Poste"} — journée du ${journee}`,
          objetType: "tache",
          objetId: t.id,
          roles: ["proprietaire"],
          cleUnique: `tache:${t.id}:non_faite`,
        });
      }
    }
  }
}

/** Activité par prénom sur une période : tâches faites, en retard, renvoyées à refaire. */
export async function activiteParPersonne(debut: ISODate, fin: ISODate) {
  const rows = await db
    .select({
      personneId: schema.personnes.id,
      prenom: schema.personnes.prenom,
      poste: schema.postes.nom,
      faites: dsql<number>`count(*) filter (where ${schema.taches.statut} in ('faite','verifiee'))`,
      retard: dsql<number>`count(*) filter (where ${schema.taches.remonteeNiveau} > 0)`,
      refaire: dsql<number>`count(*) filter (where ${schema.taches.commentaireVerif} is not null and ${schema.taches.statut} <> 'verifiee')`,
    })
    .from(schema.taches)
    .innerJoin(schema.personnes, eq(schema.personnes.id, schema.taches.faiteParPersonneId))
    .innerJoin(schema.postes, eq(schema.postes.id, schema.personnes.posteId))
    .where(and(gte(schema.taches.journee, debut), lte(schema.taches.journee, fin)))
    .groupBy(schema.personnes.id, schema.personnes.prenom, schema.postes.nom)
    .orderBy(desc(dsql`count(*)`));
  return rows.map((r) => ({ ...r, faites: Number(r.faites), retard: Number(r.retard), refaire: Number(r.refaire) }));
}

/** Part des tâches faites une journée donnée (pour l'écran des propriétaires). */
export async function partTachesFaites(journee: ISODate): Promise<{ faites: number; total: number }> {
  const [r] = await db
    .select({
      total: dsql<number>`count(*)`,
      faites: dsql<number>`count(*) filter (where ${schema.taches.statut} in ('faite','verifiee'))`,
    })
    .from(schema.taches)
    .where(and(eq(schema.taches.journee, journee), ne(schema.taches.statut, "annulee")));
  return { faites: Number(r?.faites ?? 0), total: Number(r?.total ?? 0) };
}

/** Relevés de température d'un mois, pour l'export (pièce demandée en cas de contrôle ONSSA). */
export async function relevesTemperatures(debut: ISODate, fin: ISODate) {
  const rows = await db
    .select({ t: schema.taches, prenom: schema.personnes.prenom, poste: schema.postes.nom })
    .from(schema.taches)
    .leftJoin(schema.personnes, eq(schema.personnes.id, schema.taches.faiteParPersonneId))
    .innerJoin(schema.postes, eq(schema.postes.id, schema.taches.posteId))
    .where(and(eq(schema.taches.preuve, "valeurs"), gte(schema.taches.journee, debut), lte(schema.taches.journee, fin)))
    .orderBy(asc(schema.taches.journee), asc(schema.taches.echeance));
  return rows;
}
