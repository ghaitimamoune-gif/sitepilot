import { and, desc, eq, gte, isNotNull, lt, sql as dsql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { ajouterJours, dateLocale, type ISODate } from "@/lib/dates";
import type { TypeJournee } from "@/lib/engine/types";
import { creerAlerte } from "./alertes";
import { chargerCalendrier } from "./calendrier";
import { journaliser, type Acteur } from "./journal";
import { chargerParametres, nombreDepuis } from "./parametres";

/**
 * Apprentissage : quand le détail des ventes est importé, les coefficients de vente
 * (unités pour 1 000 DH) sont recalculés chaque semaine sur 4 semaines glissantes, séparément
 * pour « semaine » et « week-end ». Une variation de plus de 20 % est soumise aux propriétaires ;
 * les autres s'appliquent seules et sont journalisées. Un coefficient figé n'est jamais touché.
 */
export async function recalculerCoefficients(aujourdHui: ISODate = dateLocale()): Promise<{ appliques: number; proposes: number; joursUtilises: number }> {
  const p = await chargerParametres();
  const semaines = nombreDepuis(p, "semaines_glissantes_coefficients");
  const seuil = nombreDepuis(p, "seuil_variation_coefficient");
  const cal = await chargerCalendrier();
  const debut = ajouterJours(aujourdHui, -7 * semaines);
  const ventes = await db
    .select({ date: schema.ventes.date, produitId: schema.ventes.produitId, quantite: dsql<string>`sum(${schema.ventes.quantite})` })
    .from(schema.ventes)
    .where(and(gte(schema.ventes.date, debut), lt(schema.ventes.date, aujourdHui), isNotNull(schema.ventes.produitId)))
    .groupBy(schema.ventes.date, schema.ventes.produitId);
  if (ventes.length === 0) return { appliques: 0, proposes: 0, joursUtilises: 0 };
  const dates = [...new Set(ventes.map((v) => v.date))];
  const caRows = await db
    .select({ date: schema.ventes.date, total: dsql<string>`sum(${schema.ventes.montant})` })
    .from(schema.ventes)
    .where(and(gte(schema.ventes.date, debut), lt(schema.ventes.date, aujourdHui)))
    .groupBy(schema.ventes.date);
  const caParDate = new Map(caRows.map((r) => [r.date, Number(r.total)]));
  const caParType: Record<TypeJournee, number> = { semaine: 0, weekend: 0 };
  for (const d of dates) caParType[cal.typeJournee(d)] += caParDate.get(d) ?? 0;
  const unites = new Map<string, number>();
  for (const v of ventes) {
    const k = `${v.produitId}|${cal.typeJournee(v.date)}`;
    unites.set(k, (unites.get(k) ?? 0) + Number(v.quantite));
  }
  const produits = await db.select().from(schema.produitsVendus).where(eq(schema.produitsVendus.actif, true));
  const coefs = await db.select().from(schema.coefficients);
  const periode = `${debut} → ${ajouterJours(aujourdHui, -1)}`;
  let appliques = 0;
  let proposes = 0;
  for (const pr of produits) {
    for (const type of ["semaine", "weekend"] as TypeJournee[]) {
      const ca = caParType[type];
      if (ca <= 0) continue;
      const u = unites.get(`${pr.id}|${type}`) ?? 0;
      const nouveau = (u * 1000) / ca;
      const actuel = coefs.find((c) => c.produitId === pr.id && c.typeJournee === type);
      if (actuel?.fige) continue;
      const ancien = actuel ? Number(actuel.valeurMesuree) : 0;
      const variation = ancien > 0 ? Math.abs(nouveau - ancien) / ancien : nouveau > 0 ? 1 : 0;
      if (Math.abs(nouveau - ancien) < 1e-6) continue;
      if (variation > seuil && ancien > 0) {
        const [enAttente] = await db
          .select()
          .from(schema.coefficientsProposes)
          .where(and(eq(schema.coefficientsProposes.produitId, pr.id), eq(schema.coefficientsProposes.typeJournee, type), eq(schema.coefficientsProposes.statut, "en_attente")));
        if (enAttente) {
          await db.update(schema.coefficientsProposes).set({ nouvelleValeur: String(nouveau), periode }).where(eq(schema.coefficientsProposes.id, enAttente.id));
        } else {
          const [prop] = await db
            .insert(schema.coefficientsProposes)
            .values({ produitId: pr.id, typeJournee: type, ancienneValeur: String(ancien), nouvelleValeur: String(nouveau), periode })
            .returning({ id: schema.coefficientsProposes.id });
          await creerAlerte({
            type: "coefficient_variation",
            niveau: "a_traiter",
            titre: `Coefficient en forte variation : ${pr.nom} (${type === "weekend" ? "week-end" : "semaine"})`,
            detail: `${ancien.toFixed(3)} → ${nouveau.toFixed(3)} (${variation >= 0 ? "+" : ""}${(((nouveau - ancien) / ancien) * 100).toFixed(0)} %) sur ${periode}. À valider avant application.`,
            objetType: "coefficient_propose",
            objetId: prop.id,
            roles: ["proprietaire"],
            cleUnique: `coef:${pr.id}:${type}`,
          });
        }
        proposes++;
      } else {
        await db
          .insert(schema.coefficients)
          .values({ produitId: pr.id, typeJournee: type, valeurMesuree: String(nouveau), periodeMesure: periode, modifieLe: new Date() })
          .onConflictDoUpdate({
            target: [schema.coefficients.produitId, schema.coefficients.typeJournee],
            set: { valeurMesuree: String(nouveau), periodeMesure: periode, modifieLe: new Date() },
          });
        await journaliser(null, "coefficient", "recalcul_hebdomadaire", {
          entiteId: pr.id,
          avant: { type, valeur: ancien },
          apres: { type, valeur: nouveau, periode },
        });
        appliques++;
      }
    }
  }
  return { appliques, proposes, joursUtilises: dates.length };
}

export async function propositionsEnAttente() {
  return db
    .select({ p: schema.coefficientsProposes, produit: schema.produitsVendus.nom })
    .from(schema.coefficientsProposes)
    .innerJoin(schema.produitsVendus, eq(schema.produitsVendus.id, schema.coefficientsProposes.produitId))
    .where(eq(schema.coefficientsProposes.statut, "en_attente"))
    .orderBy(desc(schema.coefficientsProposes.creeLe));
}

export async function deciderProposition(acteur: Acteur, id: number, ok: boolean): Promise<void> {
  const [p] = await db.select().from(schema.coefficientsProposes).where(eq(schema.coefficientsProposes.id, id));
  if (!p || p.statut !== "en_attente") return;
  await db
    .update(schema.coefficientsProposes)
    .set({ statut: ok ? "acceptee" : "refusee", decideLe: new Date(), decideParPosteId: acteur.posteId })
    .where(eq(schema.coefficientsProposes.id, id));
  if (ok) {
    await db
      .insert(schema.coefficients)
      .values({ produitId: p.produitId, typeJournee: p.typeJournee, valeurMesuree: p.nouvelleValeur, periodeMesure: p.periode, modifieLe: new Date() })
      .onConflictDoUpdate({
        target: [schema.coefficients.produitId, schema.coefficients.typeJournee],
        set: { valeurMesuree: p.nouvelleValeur, periodeMesure: p.periode, modifieLe: new Date() },
      });
  }
  await db
    .update(schema.alertes)
    .set({ traiteeLe: new Date(), traiteeParPosteId: acteur.posteId, traiteeParPersonneId: acteur.personneId, note: ok ? "Appliqué" : "Refusé" })
    .where(and(eq(schema.alertes.cleUnique, `coef:${p.produitId}:${p.typeJournee}`), dsql`${schema.alertes.traiteeLe} is null`));
  await journaliser(acteur, "coefficient", ok ? "accepter_proposition" : "refuser_proposition", {
    entiteId: p.produitId,
    avant: { type: p.typeJournee, valeur: p.ancienneValeur },
    apres: { type: p.typeJournee, valeur: ok ? p.nouvelleValeur : p.ancienneValeur },
  });
}

/** Format 2 (ventes par produit sur une période) : propositions de coefficients soumises aux propriétaires. */
export async function proposerDepuisPeriode(
  acteur: Acteur,
  lignes: { produitId: number; quantite: number }[],
  caPeriode: number,
  periode: string,
  type: TypeJournee,
): Promise<number> {
  if (caPeriode <= 0) throw new Error("Le CA de la période doit être positif.");
  const coefs = await db.select().from(schema.coefficients);
  let n = 0;
  for (const l of lignes) {
    const nouveau = (l.quantite * 1000) / caPeriode;
    const actuel = coefs.find((c) => c.produitId === l.produitId && c.typeJournee === type);
    if (actuel?.fige) continue;
    const ancien = actuel ? Number(actuel.valeurMesuree) : 0;
    if (Math.abs(nouveau - ancien) < 1e-6) continue;
    await db.insert(schema.coefficientsProposes).values({
      produitId: l.produitId,
      typeJournee: type,
      ancienneValeur: String(ancien),
      nouvelleValeur: String(nouveau),
      periode: `${periode} (fichier par produit)`,
    });
    n++;
  }
  if (n > 0) {
    await creerAlerte({
      type: "coefficient_variation",
      niveau: "a_traiter",
      titre: `${n} coefficient(s) proposé(s) depuis un fichier par produit`,
      detail: `Période ${periode}, type ${type === "weekend" ? "week-end" : "semaine"}. À valider dans Paramètres → Coefficients.`,
      roles: ["proprietaire"],
    });
    await journaliser(acteur, "coefficient", "proposer_depuis_periode", { apres: { n, periode, type } });
  }
  return n;
}
