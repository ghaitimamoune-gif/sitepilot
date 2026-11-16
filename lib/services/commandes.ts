import { and, asc, desc, eq, inArray, isNull, ne, sql as dsql } from "drizzle-orm";
import { db, schema, type Tx } from "@/lib/db";
import { dateLocale, dateLongue, heureLocale, joursEntre, type ISODate } from "@/lib/dates";
import { prochaineLivraison, proposerQuantite, proposerQuantiteFixe, type PropositionCommande } from "@/lib/engine/commandes";
import { arrondiConditionnement } from "@/lib/engine/moteur";
import { fmtQuantite } from "@/lib/format";
import { creerAlerte } from "./alertes";
import { chargerCalendrier } from "./calendrier";
import { journaliser, type Acteur } from "./journal";
import { chargerMoteur } from "./moteur";
import { chargerParametres, nombreDepuis } from "./parametres";
import { articlesEnRupture } from "./ruptures";
import { articlesComptes, derniersPrix, quantitesEnCommande, stocksTheoriques, type PrixConnu } from "./stock";
import { validerTacheLiee } from "./taches";

export type StatutCommande = (typeof schema.statutCommandeEnum.enumValues)[number];
export type OrigineLigne = (typeof schema.origineLigneEnum.enumValues)[number];

export const LIBELLE_STATUT_COMMANDE: Record<StatutCommande, string> = {
  brouillon: "Brouillon",
  en_attente_validation: "En attente de validation",
  refusee: "Refusée",
  prete: "Prête à envoyer",
  envoyee: "Envoyée",
  recue_partiellement: "Reçue partiellement",
  recue: "Reçue",
  cloturee: "Clôturée",
};

export const LIBELLE_ORIGINE: Record<OrigineLigne, string> = {
  moteur: "Besoin calculé",
  comptage: "Comptage",
  rupture: "Rupture",
  reception: "Réception",
  manuel: "Ajout manuel",
};

export interface FournisseurVue {
  id: number;
  nom: string;
  contact: string | null;
  whatsapp: string | null;
  joursLivraison: number[];
  heureLimite: string | null;
  delaiJours: number;
  validationRequise: boolean;
  statut: "actif" | "a_verifier" | "archive";
  achatDirect: boolean;
}

export interface OptionFournisseur {
  articleFournisseurId: number;
  fournisseurId: number;
  fournisseurNom: string;
  uniteCommande: string;
  qteParUniteCommande: number;
  prixHt: number | null;
  prixDate: ISODate | null;
  aReverifier: boolean;
  dateLivraison: ISODate | null;
}

export interface LigneProposee {
  articleId: number;
  nom: string;
  unite: string;
  estPiece: boolean;
  structurant: boolean;
  enRupture: boolean;
  origine: OrigineLigne;
  stockActuel: number;
  enCommande: number;
  besoin: number;
  aCommanderComptage: number;
  aCommanderUnites: number;
  jours: ISODate[];
  joursSecurite: ISODate[];
  choisi: OptionFournisseur | null;
  options: OptionFournisseur[];
}

export interface GroupeFournisseur {
  fournisseur: FournisseurVue | null;
  dateLivraison: ISODate | null;
  apresHeureLimite: boolean;
  lignes: LigneProposee[];
}

function apresHeureLimite(heureLimite: string | null, maintenant: Date): boolean {
  if (!heureLimite) return false;
  return heureLocale(maintenant) > heureLimite;
}

export async function listerFournisseurs(inclureArchives = false): Promise<FournisseurVue[]> {
  const rows = await db.select().from(schema.fournisseurs).orderBy(asc(schema.fournisseurs.nom));
  return rows
    .filter((f) => inclureArchives || f.statut !== "archive")
    .map((f) => ({
      id: f.id,
      nom: f.nom,
      contact: f.contact,
      whatsapp: f.whatsapp,
      joursLivraison: f.joursLivraison,
      heureLimite: f.heureLimite,
      delaiJours: f.delaiJours,
      validationRequise: f.validationRequise,
      statut: f.statut,
      achatDirect: f.achatDirect,
    }));
}

/**
 * Lignes à commander, groupées par fournisseur. La responsable achats ne calcule rien :
 * le fournisseur présélectionné est celui dont le dernier prix est le plus bas.
 */
export async function calculerPropositions(dateCommande: ISODate = dateLocale(), maintenant = new Date()): Promise<GroupeFournisseur[]> {
  const [charge, cal, p, stocks, enCommande, prixMap, afRows, fournisseurs, ruptures, comptes, clotureJour] = await Promise.all([
    chargerMoteur(),
    chargerCalendrier(),
    chargerParametres(),
    stocksTheoriques(),
    quantitesEnCommande(),
    derniersPrix(),
    db.select().from(schema.articleFournisseurs).where(eq(schema.articleFournisseurs.actif, true)),
    listerFournisseurs(),
    articlesEnRupture(),
    articlesComptes(),
    db.select({ date: schema.cloturesJournee.date }).from(schema.cloturesJournee).where(eq(schema.cloturesJournee.date, dateCommande)),
  ]);
  const consommationDuJourComptee = clotureJour.length > 0;
  const joursReverif = nombreDepuis(p, "prix_a_reverifier_jours");
  const fournisseurParId = new Map(fournisseurs.map((f) => [f.id, f]));
  const afParArticle = new Map<number, (typeof afRows)[number][]>();
  for (const af of afRows) {
    if (!fournisseurParId.has(af.fournisseurId)) continue;
    const arr = afParArticle.get(af.articleId) ?? [];
    arr.push(af);
    afParArticle.set(af.articleId, arr);
  }
  const groupes = new Map<number | 0, GroupeFournisseur>();
  const groupe = (f: FournisseurVue | null): GroupeFournisseur => {
    const k = f?.id ?? 0;
    let g = groupes.get(k);
    if (!g) {
      const tard = f ? apresHeureLimite(f.heureLimite, maintenant) : false;
      g = {
        fournisseur: f,
        dateLivraison: f ? prochaineLivraison({ joursLivraison: f.joursLivraison, delaiJours: f.delaiJours }, cal, dateCommande, tard) : null,
        apresHeureLimite: tard,
        lignes: [],
      };
      groupes.set(k, g);
    }
    return g;
  };

  for (const a of charge.articles.values()) {
    if (a.statut === "archive" || a.nature === "preparation") continue;
    const enRupture = ruptures.has(a.id);
    // Stock inconnu (jamais compté) : on ne commande pas sur un chiffre inventé, sauf rupture signalée.
    if (!enRupture && !comptes.has(a.id)) continue;
    const liens = afParArticle.get(a.id) ?? [];
    const prixArticle = prixMap.get(a.id) ?? [];
    const options: OptionFournisseur[] = liens.map((af) => {
      const f = fournisseurParId.get(af.fournisseurId)!;
      const pr: PrixConnu | undefined = prixArticle.find((x) => x.articleFournisseurId === af.id);
      const tard = apresHeureLimite(f.heureLimite, maintenant);
      return {
        articleFournisseurId: af.id,
        fournisseurId: f.id,
        fournisseurNom: f.nom,
        uniteCommande: af.uniteCommande,
        qteParUniteCommande: Number(af.qteParUniteCommande) || 1,
        prixHt: pr ? pr.prixHt : null,
        prixDate: pr ? pr.date : null,
        aReverifier: pr ? joursEntre(pr.date, dateCommande) > joursReverif : true,
        dateLivraison: prochaineLivraison({ joursLivraison: f.joursLivraison, delaiJours: f.delaiJours }, cal, dateCommande, tard),
      };
    });
    // Présélection : prix le plus bas par unité de comptage, à défaut le premier.
    const choisi =
      options.length === 0
        ? null
        : [...options].sort((x, y) => {
            const px = x.prixHt === null ? Number.POSITIVE_INFINITY : x.prixHt / x.qteParUniteCommande;
            const py = y.prixHt === null ? Number.POSITIVE_INFINITY : y.prixHt / y.qteParUniteCommande;
            return px - py;
          })[0];
    const f = choisi ? fournisseurParId.get(choisi.fournisseurId)! : null;
    const stockActuel = stocks.get(a.id) ?? 0;
    const dejaCommande = enCommande.get(a.id) ?? 0;
    let prop: PropositionCommande | null = null;
    let besoin = 0;
    let aCommanderComptage = 0;
    let aCommanderUnites = 0;
    let jours: ISODate[] = [];
    let joursSecurite: ISODate[] = [];
    const qteUnite = choisi?.qteParUniteCommande ?? 1;
    if (a.lieAuxVentes) {
      const fl = f ? { joursLivraison: f.joursLivraison, delaiJours: f.delaiJours } : { joursLivraison: [], delaiJours: 1 };
      prop = proposerQuantite({
        moteur: charge.moteur,
        articleId: a.id,
        fournisseur: fl,
        dateCommande,
        apresHeureLimite: f ? apresHeureLimite(f.heureLimite, maintenant) : false,
        stockActuel,
        enCommande: dejaCommande,
        qteParUniteCommande: qteUnite,
        seuilDlcVeilleFermeture: charge.donnees.seuilDlcVeilleFermeture,
        consommationDuJourComptee,
      });
      if (prop) {
        besoin = prop.besoin;
        aCommanderComptage = prop.aCommanderComptage;
        aCommanderUnites = prop.aCommanderUnites;
        jours = prop.jours;
        joursSecurite = prop.joursSecurite;
      }
    } else {
      const r = proposerQuantiteFixe({
        stockActuel,
        enCommande: dejaCommande,
        stockMinimum: a.stockMinimum,
        stockCible: a.stockCibleFixe,
        qteParUniteCommande: qteUnite,
      });
      besoin = a.stockCibleFixe ?? 0;
      aCommanderComptage = r.aCommanderComptage;
      aCommanderUnites = r.aCommanderUnites;
    }
    if (enRupture && aCommanderUnites === 0) {
      // Ligne prioritaire : au moins un conditionnement.
      aCommanderUnites = 1;
      aCommanderComptage = qteUnite;
    }
    if (aCommanderUnites <= 0) continue;
    groupe(f).lignes.push({
      articleId: a.id,
      nom: a.nom,
      unite: a.uniteComptage,
      estPiece: a.estPiece,
      structurant: a.structurant,
      enRupture,
      origine: enRupture ? "rupture" : a.lieAuxVentes ? "moteur" : "comptage",
      stockActuel,
      enCommande: dejaCommande,
      besoin,
      aCommanderComptage,
      aCommanderUnites,
      jours,
      joursSecurite,
      choisi,
      options,
    });
  }
  const res = [...groupes.values()];
  for (const g of res) g.lignes.sort((x, y) => Number(y.enRupture) - Number(x.enRupture) || x.nom.localeCompare(y.nom, "fr"));
  res.sort((x, y) => {
    if (!x.fournisseur) return 1;
    if (!y.fournisseur) return -1;
    return x.fournisseur.nom.localeCompare(y.fournisseur.nom, "fr");
  });
  return res;
}

// ---------------------------------------------------------------------------
// Brouillons
// ---------------------------------------------------------------------------

async function brouillonPour(ex: Tx | typeof db, acteur: Acteur, fournisseurId: number, dateLivraison: ISODate) {
  const [existant] = await ex
    .select()
    .from(schema.commandes)
    .where(and(eq(schema.commandes.fournisseurId, fournisseurId), inArray(schema.commandes.statut, ["brouillon", "refusee"])))
    .orderBy(desc(schema.commandes.id))
    .limit(1);
  if (existant) {
    if (existant.dateLivraison !== dateLivraison || existant.statut === "refusee") {
      await ex.update(schema.commandes).set({ dateLivraison, statut: "brouillon", modifieLe: new Date() }).where(eq(schema.commandes.id, existant.id));
    }
    return existant.id;
  }
  const [c] = await ex
    .insert(schema.commandes)
    .values({ fournisseurId, dateLivraison, statut: "brouillon", creeParPosteId: acteur.posteId, creeParPersonneId: acteur.personneId })
    .returning({ id: schema.commandes.id });
  return c.id;
}

/**
 * Crée ou met à jour les brouillons à partir des propositions. Une quantité modifiée à la
 * main est conservée ; une ligne manuelle n'est jamais retirée.
 */
export async function genererBrouillons(acteur: Acteur, dateCommande: ISODate = dateLocale()): Promise<number[]> {
  const groupes = await calculerPropositions(dateCommande);
  const ids: number[] = [];
  await db.transaction(async (tx) => {
    for (const g of groupes) {
      if (!g.fournisseur || !g.dateLivraison) continue;
      const commandeId = await brouillonPour(tx, acteur, g.fournisseur.id, g.dateLivraison);
      ids.push(commandeId);
      const existantes = await tx.select().from(schema.commandeLignes).where(eq(schema.commandeLignes.commandeId, commandeId));
      const vues = new Set<number>();
      for (const l of g.lignes) {
        if (!l.choisi) continue;
        vues.add(l.articleId);
        const ex = existantes.find((e) => e.articleId === l.articleId);
        const prixEstime = l.choisi.prixHt;
        if (ex) {
          const modifieeALaMain = Number(ex.qteCommandee) !== Number(ex.qteProposee);
          await tx
            .update(schema.commandeLignes)
            .set({
              qteProposee: String(l.aCommanderUnites),
              qteCommandee: modifieeALaMain ? ex.qteCommandee : String(l.aCommanderUnites),
              qteComptage: String((modifieeALaMain ? Number(ex.qteCommandee) : l.aCommanderUnites) * l.choisi.qteParUniteCommande),
              articleFournisseurId: ex.articleFournisseurId ?? l.choisi.articleFournisseurId,
              prixEstime: prixEstime === null ? null : String(prixEstime),
              origine: ex.origine === "manuel" || ex.origine === "reception" ? ex.origine : l.origine,
              prioritaire: l.enRupture,
              detail: l.jours.length > 0 ? `Couvre ${l.jours.length + l.joursSecurite.length} jour(s) de service` : null,
            })
            .where(eq(schema.commandeLignes.id, ex.id));
        } else {
          await tx.insert(schema.commandeLignes).values({
            commandeId,
            articleId: l.articleId,
            articleFournisseurId: l.choisi.articleFournisseurId,
            qteProposee: String(l.aCommanderUnites),
            qteCommandee: String(l.aCommanderUnites),
            qteComptage: String(l.aCommanderComptage > 0 ? l.aCommanderUnites * l.choisi.qteParUniteCommande : l.choisi.qteParUniteCommande),
            prixEstime: prixEstime === null ? null : String(prixEstime),
            origine: l.origine,
            prioritaire: l.enRupture,
            detail: l.jours.length > 0 ? `Couvre ${l.jours.length + l.joursSecurite.length} jour(s) de service` : null,
          });
        }
      }
      // Lignes calculées qui ne sont plus proposées : retirées du brouillon (pas les manuelles ni celles d'une réception).
      for (const e of existantes) {
        if (vues.has(e.articleId)) continue;
        if (e.origine === "manuel" || e.origine === "reception") continue;
        if (Number(e.qteCommandee) !== Number(e.qteProposee)) continue;
        await tx.delete(schema.commandeLignes).where(eq(schema.commandeLignes.id, e.id));
      }
      await recalculerMontant(tx, commandeId);
    }
  });
  await journaliser(acteur, "commande", "generer_brouillons", { apres: { commandes: ids } });
  return ids;
}

/** Dernier prix HT connu d'un article chez un fournisseur (par unité de commande), ou null. */
async function dernierPrixHt(ex: Tx | typeof db, articleFournisseurId: number): Promise<string | null> {
  const [p] = await ex
    .select({ prixHt: schema.prix.prixHt })
    .from(schema.prix)
    .where(eq(schema.prix.articleFournisseurId, articleFournisseurId))
    .orderBy(desc(schema.prix.date), desc(schema.prix.id))
    .limit(1);
  return p?.prixHt ?? null;
}

async function recalculerMontant(ex: Tx | typeof db, commandeId: number): Promise<void> {
  const [r] = await ex
    .select({ total: dsql<string>`coalesce(sum(${schema.commandeLignes.qteCommandee} * coalesce(${schema.commandeLignes.prixEstime}, 0)), 0)` })
    .from(schema.commandeLignes)
    .where(eq(schema.commandeLignes.commandeId, commandeId));
  await ex.update(schema.commandes).set({ montantEstime: String(Number(r?.total ?? 0)), modifieLe: new Date() }).where(eq(schema.commandes.id, commandeId));
}

async function exigerModifiable(commandeId: number) {
  const [c] = await db.select().from(schema.commandes).where(eq(schema.commandes.id, commandeId));
  if (!c) throw new Error("Commande introuvable.");
  if (!["brouillon", "refusee", "prete"].includes(c.statut)) throw new Error("Cette commande ne se modifie plus.");
  return c;
}

export async function modifierLigne(acteur: Acteur, ligneId: number, qteCommandee: number): Promise<void> {
  const [l] = await db.select().from(schema.commandeLignes).where(eq(schema.commandeLignes.id, ligneId));
  if (!l) throw new Error("Ligne introuvable.");
  await exigerModifiable(l.commandeId);
  let qteUnite = 1;
  if (l.articleFournisseurId) {
    const [af] = await db.select().from(schema.articleFournisseurs).where(eq(schema.articleFournisseurs.id, l.articleFournisseurId));
    qteUnite = Number(af?.qteParUniteCommande ?? 1) || 1;
  }
  await db
    .update(schema.commandeLignes)
    .set({ qteCommandee: String(Math.max(0, qteCommandee)), qteComptage: String(Math.max(0, qteCommandee) * qteUnite) })
    .where(eq(schema.commandeLignes.id, ligneId));
  await recalculerMontant(db, l.commandeId);
  await journaliser(acteur, "commande_ligne", "modifier", { entiteId: ligneId, avant: { qte: l.qteCommandee }, apres: { qte: qteCommandee } });
}

export async function retirerLigne(acteur: Acteur, ligneId: number): Promise<void> {
  const [l] = await db.select().from(schema.commandeLignes).where(eq(schema.commandeLignes.id, ligneId));
  if (!l) return;
  await exigerModifiable(l.commandeId);
  await db.delete(schema.commandeLignes).where(eq(schema.commandeLignes.id, ligneId));
  await recalculerMontant(db, l.commandeId);
  await journaliser(acteur, "commande_ligne", "retirer", { entiteId: ligneId, avant: l });
}

/** Déplace une ligne vers un autre fournisseur de l'article (brouillon de ce fournisseur). */
export async function changerFournisseurLigne(acteur: Acteur, ligneId: number, articleFournisseurId: number): Promise<number> {
  const [l] = await db.select().from(schema.commandeLignes).where(eq(schema.commandeLignes.id, ligneId));
  if (!l) throw new Error("Ligne introuvable.");
  const c = await exigerModifiable(l.commandeId);
  const [af] = await db.select().from(schema.articleFournisseurs).where(eq(schema.articleFournisseurs.id, articleFournisseurId));
  if (!af || af.articleId !== l.articleId) throw new Error("Fournisseur non lié à cet article.");
  if (af.fournisseurId === c.fournisseurId) {
    await db
      .update(schema.commandeLignes)
      .set({ articleFournisseurId, prixEstime: await dernierPrixHt(db, articleFournisseurId) })
      .where(eq(schema.commandeLignes.id, ligneId));
    await recalculerMontant(db, c.id);
    return c.id;
  }
  const [f] = await db.select().from(schema.fournisseurs).where(eq(schema.fournisseurs.id, af.fournisseurId));
  const cal = await chargerCalendrier();
  const dateLivraison = prochaineLivraison({ joursLivraison: f.joursLivraison, delaiJours: f.delaiJours }, cal, dateLocale(), apresHeureLimite(f.heureLimite, new Date())) ?? c.dateLivraison;
  const cible = await db.transaction(async (tx) => {
    const id = await brouillonPour(tx, acteur, af.fournisseurId, dateLivraison);
    await tx.delete(schema.commandeLignes).where(eq(schema.commandeLignes.id, ligneId));
    await tx.insert(schema.commandeLignes).values({
      commandeId: id,
      articleId: l.articleId,
      articleFournisseurId,
      qteProposee: l.qteProposee,
      qteCommandee: l.qteCommandee,
      qteComptage: String(Number(l.qteCommandee) * (Number(af.qteParUniteCommande) || 1)),
      prixEstime: await dernierPrixHt(tx, articleFournisseurId),
      origine: l.origine,
      prioritaire: l.prioritaire,
      detail: l.detail,
    });
    await recalculerMontant(tx, c.id);
    await recalculerMontant(tx, id);
    return id;
  });
  await journaliser(acteur, "commande_ligne", "changer_fournisseur", { entiteId: ligneId, apres: { commandeId: cible } });
  return cible;
}

export async function ajouterLigneManuelle(acteur: Acteur, fournisseurId: number, articleId: number, qteCommandee: number, origine: OrigineLigne = "manuel", tx?: Tx): Promise<number> {
  const ex = tx ?? db;
  const [f] = await ex.select().from(schema.fournisseurs).where(eq(schema.fournisseurs.id, fournisseurId));
  if (!f) throw new Error("Fournisseur introuvable.");
  let [af] = await ex
    .select()
    .from(schema.articleFournisseurs)
    .where(and(eq(schema.articleFournisseurs.articleId, articleId), eq(schema.articleFournisseurs.fournisseurId, fournisseurId)));
  if (!af) {
    const [a] = await ex.select().from(schema.articles).where(eq(schema.articles.id, articleId));
    if (!a) throw new Error("Article introuvable.");
    [af] = await ex
      .insert(schema.articleFournisseurs)
      .values({ articleId, fournisseurId, uniteCommande: a.uniteComptage, qteParUniteCommande: "1" })
      .returning();
  }
  const cal = await chargerCalendrier();
  const dateLivraison = prochaineLivraison({ joursLivraison: f.joursLivraison, delaiJours: f.delaiJours }, cal, dateLocale(), apresHeureLimite(f.heureLimite, new Date())) ?? dateLocale();
  const commandeId = await brouillonPour(ex, acteur, fournisseurId, dateLivraison);
  const [existante] = await ex
    .select()
    .from(schema.commandeLignes)
    .where(and(eq(schema.commandeLignes.commandeId, commandeId), eq(schema.commandeLignes.articleId, articleId)));
  const q = Math.max(0, qteCommandee);
  const qteUnite = Number(af.qteParUniteCommande) || 1;
  // Dernier prix connu : sans lui, le montant estimé d'une commande saisie à la main restait à 0 DH.
  const prix = await dernierPrixHt(ex, af.id);
  if (existante) {
    const total = Number(existante.qteCommandee) + q;
    await ex
      .update(schema.commandeLignes)
      .set({
        qteCommandee: String(total),
        qteComptage: String(total * qteUnite),
        origine: existante.origine === "moteur" ? origine : existante.origine,
        prixEstime: existante.prixEstime ?? prix,
      })
      .where(eq(schema.commandeLignes.id, existante.id));
  } else {
    await ex.insert(schema.commandeLignes).values({
      commandeId,
      articleId,
      articleFournisseurId: af.id,
      qteProposee: String(q),
      qteCommandee: String(q),
      qteComptage: String(q * qteUnite),
      prixEstime: prix,
      origine,
    });
  }
  await recalculerMontant(ex, commandeId);
  await journaliser(acteur, "commande_ligne", "ajouter", { entiteId: commandeId, apres: { articleId, qteCommandee: q, origine }, tx });
  return commandeId;
}

// ---------------------------------------------------------------------------
// Cycle de vie
// ---------------------------------------------------------------------------

export interface CommandeVue {
  commande: typeof schema.commandes.$inferSelect;
  fournisseur: FournisseurVue;
  lignes: {
    id: number;
    articleId: number;
    nom: string;
    unite: string;
    uniteCommande: string;
    qteParUniteCommande: number;
    qteProposee: number;
    qteCommandee: number;
    qteComptage: number;
    qteRecue: number;
    prixEstime: number | null;
    origine: OrigineLigne;
    prioritaire: boolean;
    detail: string | null;
    structurant: boolean;
    options: OptionFournisseur[];
  }[];
  haussesPrix: { nom: string; ancien: number; nouveau: number }[];
}

export async function commandeVue(commandeId: number): Promise<CommandeVue | null> {
  const [c] = await db.select().from(schema.commandes).where(eq(schema.commandes.id, commandeId));
  if (!c) return null;
  const [f] = await db.select().from(schema.fournisseurs).where(eq(schema.fournisseurs.id, c.fournisseurId));
  const [lignes, charge, prixMap, afRows, fournisseurs] = await Promise.all([
    db.select().from(schema.commandeLignes).where(eq(schema.commandeLignes.commandeId, commandeId)).orderBy(asc(schema.commandeLignes.id)),
    chargerMoteur(),
    derniersPrix(),
    db.select().from(schema.articleFournisseurs).where(eq(schema.articleFournisseurs.actif, true)),
    listerFournisseurs(),
  ]);
  const p = await chargerParametres();
  const joursReverif = nombreDepuis(p, "prix_a_reverifier_jours");
  const fParId = new Map(fournisseurs.map((x) => [x.id, x]));
  const afParId = new Map(afRows.map((x) => [x.id, x]));
  const vue: CommandeVue["lignes"] = lignes.map((l) => {
    const a = charge.articles.get(l.articleId);
    const af = l.articleFournisseurId ? afParId.get(l.articleFournisseurId) : undefined;
    const options: OptionFournisseur[] = afRows
      .filter((x) => x.articleId === l.articleId && fParId.has(x.fournisseurId))
      .map((x) => {
        const pr = (prixMap.get(l.articleId) ?? []).find((y) => y.articleFournisseurId === x.id);
        return {
          articleFournisseurId: x.id,
          fournisseurId: x.fournisseurId,
          fournisseurNom: fParId.get(x.fournisseurId)!.nom,
          uniteCommande: x.uniteCommande,
          qteParUniteCommande: Number(x.qteParUniteCommande) || 1,
          prixHt: pr?.prixHt ?? null,
          prixDate: pr?.date ?? null,
          aReverifier: pr ? joursEntre(pr.date, dateLocale()) > joursReverif : true,
          dateLivraison: null,
        };
      });
    return {
      id: l.id,
      articleId: l.articleId,
      nom: a?.nom ?? `Article ${l.articleId}`,
      unite: a?.uniteComptage ?? "",
      uniteCommande: af?.uniteCommande ?? a?.uniteComptage ?? "",
      qteParUniteCommande: Number(af?.qteParUniteCommande ?? 1) || 1,
      qteProposee: Number(l.qteProposee),
      qteCommandee: Number(l.qteCommandee),
      qteComptage: Number(l.qteComptage),
      qteRecue: Number(l.qteRecue),
      prixEstime: l.prixEstime === null ? null : Number(l.prixEstime),
      origine: l.origine,
      prioritaire: l.prioritaire,
      detail: l.detail,
      structurant: a?.structurant ?? false,
      options,
    };
  });
  // Hausses de prix : dernier prix chez ce fournisseur contre le précédent.
  const haussesPrix: CommandeVue["haussesPrix"] = [];
  for (const l of lignes) {
    if (!l.articleFournisseurId) continue;
    const deux = await db
      .select()
      .from(schema.prix)
      .where(eq(schema.prix.articleFournisseurId, l.articleFournisseurId))
      .orderBy(desc(schema.prix.date), desc(schema.prix.id))
      .limit(2);
    if (deux.length === 2 && Number(deux[0].prixHt) > Number(deux[1].prixHt)) {
      haussesPrix.push({ nom: charge.articles.get(l.articleId)?.nom ?? "", ancien: Number(deux[1].prixHt), nouveau: Number(deux[0].prixHt) });
    }
  }
  return {
    commande: c,
    fournisseur: {
      id: f.id,
      nom: f.nom,
      contact: f.contact,
      whatsapp: f.whatsapp,
      joursLivraison: f.joursLivraison,
      heureLimite: f.heureLimite,
      delaiJours: f.delaiJours,
      validationRequise: f.validationRequise,
      statut: f.statut,
      achatDirect: f.achatDirect,
    },
    lignes: vue,
    haussesPrix,
  };
}

export async function listerCommandes(statuts?: StatutCommande[], limite = 100) {
  const rows = await db
    .select({ c: schema.commandes, fournisseur: schema.fournisseurs.nom, heureLimite: schema.fournisseurs.heureLimite, validationRequise: schema.fournisseurs.validationRequise })
    .from(schema.commandes)
    .innerJoin(schema.fournisseurs, eq(schema.fournisseurs.id, schema.commandes.fournisseurId))
    .where(statuts && statuts.length > 0 ? inArray(schema.commandes.statut, statuts) : undefined)
    .orderBy(desc(schema.commandes.modifieLe))
    .limit(limite);
  const compte = await db
    .select({ commandeId: schema.commandeLignes.commandeId, n: dsql<number>`count(*)`, prioritaire: dsql<number>`count(*) filter (where ${schema.commandeLignes.prioritaire})` })
    .from(schema.commandeLignes)
    .groupBy(schema.commandeLignes.commandeId);
  const parId = new Map(compte.map((x) => [x.commandeId, { n: Number(x.n), prioritaire: Number(x.prioritaire) }]));
  return rows.map((r) => ({ ...r, nbLignes: parId.get(r.c.id)?.n ?? 0, nbPrioritaires: parId.get(r.c.id)?.prioritaire ?? 0 }));
}

/** Passe un brouillon à « prête » ou, si le fournisseur l'exige, « en attente de validation ». */
export async function preparerCommande(acteur: Acteur, commandeId: number): Promise<StatutCommande> {
  const c = await exigerModifiable(commandeId);
  const [f] = await db.select().from(schema.fournisseurs).where(eq(schema.fournisseurs.id, c.fournisseurId));
  const lignes = await db.select().from(schema.commandeLignes).where(and(eq(schema.commandeLignes.commandeId, commandeId), ne(schema.commandeLignes.qteCommandee, "0")));
  if (lignes.length === 0) throw new Error("La commande n'a aucune ligne.");
  await recalculerMontant(db, commandeId);
  const statut: StatutCommande = f.validationRequise ? "en_attente_validation" : "prete";
  await db.update(schema.commandes).set({ statut, soumiseLe: new Date(), modifieLe: new Date() }).where(eq(schema.commandes.id, commandeId));
  if (statut === "en_attente_validation") {
    const vue = await commandeVue(commandeId);
    await creerAlerte({
      type: "commande_a_valider",
      niveau: "a_traiter",
      titre: `Commande à valider : ${f.nom}`,
      detail: `${lignes.length} ligne(s), montant estimé ${Number(vue?.commande.montantEstime ?? 0).toFixed(0)} DH${(vue?.haussesPrix.length ?? 0) > 0 ? `, ${vue!.haussesPrix.length} hausse(s) de prix` : ""}`,
      objetType: "commande",
      objetId: commandeId,
      roles: ["proprietaire"],
      cleUnique: `commande_valider:${commandeId}`,
    });
  }
  await journaliser(acteur, "commande", "preparer", { entiteId: commandeId, apres: { statut } });
  return statut;
}

export async function validerCommande(acteur: Acteur, commandeId: number, ok: boolean, commentaire: string | null): Promise<void> {
  const [c] = await db.select().from(schema.commandes).where(eq(schema.commandes.id, commandeId));
  if (!c || c.statut !== "en_attente_validation") throw new Error("Cette commande n'attend pas de validation.");
  if (!ok && !commentaire?.trim()) throw new Error("Un commentaire est demandé pour refuser.");
  await db
    .update(schema.commandes)
    .set({
      statut: ok ? "prete" : "refusee",
      valideeParPosteId: acteur.posteId,
      valideeParPersonneId: acteur.personneId,
      valideeLe: new Date(),
      commentaireValidation: commentaire?.trim() || null,
      modifieLe: new Date(),
    })
    .where(eq(schema.commandes.id, commandeId));
  await db
    .update(schema.alertes)
    .set({ traiteeLe: new Date(), traiteeParPosteId: acteur.posteId, traiteeParPersonneId: acteur.personneId, note: ok ? "Validée" : `Refusée : ${commentaire}` })
    .where(and(eq(schema.alertes.cleUnique, `commande_valider:${commandeId}`), isNull(schema.alertes.traiteeLe)));
  await journaliser(acteur, "commande", ok ? "valider" : "refuser", { entiteId: commandeId, apres: { commentaire } });
}

/** Retour en brouillon d'une commande prête (avant envoi). */
export async function remettreEnBrouillon(acteur: Acteur, commandeId: number): Promise<void> {
  const [c] = await db.select().from(schema.commandes).where(eq(schema.commandes.id, commandeId));
  if (!c || !["prete", "refusee", "en_attente_validation"].includes(c.statut)) return;
  await db.update(schema.commandes).set({ statut: "brouillon", modifieLe: new Date() }).where(eq(schema.commandes.id, commandeId));
  await journaliser(acteur, "commande", "remettre_en_brouillon", { entiteId: commandeId, avant: { statut: c.statut } });
}

function numeroWhatsApp(n: string | null): string | null {
  if (!n) return null;
  const digits = n.replace(/\D/g, "");
  if (digits.length < 8) return null;
  // 06 12 34 56 78 → 212612345678
  if (digits.startsWith("0") && digits.length === 10) return `212${digits.slice(1)}`;
  if (digits.startsWith("00")) return digits.slice(2);
  return digits;
}

/** Message de commande et lien wa.me (aucun pilotage de WhatsApp : la responsable achats appuie sur envoyer). */
export async function messageWhatsApp(commandeId: number, prenom: string): Promise<{ texte: string; url: string | null; numero: string | null }> {
  const vue = await commandeVue(commandeId);
  if (!vue) throw new Error("Commande introuvable.");
  const p = await chargerParametres();
  const modele = p.modele_message_commande ?? "";
  const lignes = vue.lignes
    .filter((l) => l.qteCommandee > 0)
    .map((l) => `- ${fmtQuantite(l.qteCommandee, Number.isInteger(l.qteCommandee))} ${l.uniteCommande} - ${l.nom}`)
    .join("\n");
  const date = vue.commande.dateLivraison;
  const texte = modele
    .replace("{contact}", vue.fournisseur.contact?.trim() || vue.fournisseur.nom)
    .replace("{jour} {date}", dateLongue(date))
    .replace("{jour}", dateLongue(date).split(" ")[0])
    .replace("{date}", dateLongue(date).split(" ").slice(1).join(" "))
    .replace("{lignes}", lignes)
    .replace("{prenom}", prenom);
  const numero = numeroWhatsApp(vue.fournisseur.whatsapp);
  const url = numero ? `https://wa.me/${numero}?text=${encodeURIComponent(texte)}` : null;
  return { texte, url, numero };
}

/** La commande ne passe « envoyée » qu'après confirmation de la responsable achats. */
export async function confirmerEnvoi(acteur: Acteur, commandeId: number, texte: string): Promise<void> {
  const [c] = await db.select().from(schema.commandes).where(eq(schema.commandes.id, commandeId));
  if (!c || c.statut !== "prete") throw new Error("Seule une commande prête s'envoie.");
  await db
    .update(schema.commandes)
    .set({ statut: "envoyee", envoyeeLe: new Date(), envoyeeParPersonneId: acteur.personneId, message: texte, modifieLe: new Date() })
    .where(eq(schema.commandes.id, commandeId));
  await journaliser(acteur, "commande", "envoyer", { entiteId: commandeId });
  // La tâche « Passer les commandes » se valide quand plus aucune commande n'est prête ou en brouillon avec lignes.
  const restantes = await db
    .select({ id: schema.commandes.id })
    .from(schema.commandes)
    .where(inArray(schema.commandes.statut, ["prete"]));
  if (restantes.length === 0) await validerTacheLiee(acteur, "commandes");
}

export async function cloturerCommande(acteur: Acteur, commandeId: number): Promise<void> {
  const [c] = await db.select().from(schema.commandes).where(eq(schema.commandes.id, commandeId));
  if (!c || !["recue", "recue_partiellement", "envoyee"].includes(c.statut)) return;
  await db.update(schema.commandes).set({ statut: "cloturee", modifieLe: new Date() }).where(eq(schema.commandes.id, commandeId));
  await journaliser(acteur, "commande", "cloturer", { entiteId: commandeId, avant: { statut: c.statut } });
}

/** Articles achetés jamais comptés : leur stock est inconnu, ils ne sont pas proposés tant qu'un comptage ne les a pas fixés. */
export async function articlesJamaisComptes(): Promise<{ id: number; nom: string; famille: string | null }[]> {
  const [charge, comptes, liens] = await Promise.all([
    chargerMoteur(),
    articlesComptes(),
    db.selectDistinct({ articleId: schema.articleFournisseurs.articleId }).from(schema.articleFournisseurs).where(eq(schema.articleFournisseurs.actif, true)),
  ]);
  const avecFournisseur = new Set(liens.map((l) => l.articleId));
  return [...charge.articles.values()]
    .filter((a) => a.statut !== "archive" && a.nature !== "preparation" && avecFournisseur.has(a.id) && !comptes.has(a.id))
    .map((a) => ({ id: a.id, nom: a.nom, famille: a.familleNom }))
    .sort((x, y) => (x.famille ?? "").localeCompare(y.famille ?? "", "fr") || x.nom.localeCompare(y.nom, "fr"));
}

/** Si une commande envoyée doit être complétée (prévisionnel corrigé), le complément apparaît comme nouvelle proposition. */
export async function complementsApresEnvoi(): Promise<{ fournisseur: string; nom: string; complement: number; unite: string }[]> {
  const groupes = await calculerPropositions();
  const res: { fournisseur: string; nom: string; complement: number; unite: string }[] = [];
  for (const g of groupes) {
    for (const l of g.lignes) {
      if (l.enCommande > 0 && l.aCommanderUnites > 0 && l.choisi) {
        res.push({ fournisseur: g.fournisseur?.nom ?? "—", nom: l.nom, complement: l.aCommanderUnites, unite: l.choisi.uniteCommande });
      }
    }
  }
  return res;
}

export { arrondiConditionnement };
