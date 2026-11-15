import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";
import { db, schema, type Tx } from "@/lib/db";
import { journeeExploitation, type ISODate } from "@/lib/dates";
import { creerAlerte } from "./alertes";
import { ajouterLigneManuelle } from "./commandes";
import { journaliser, type Acteur } from "./journal";
import { chargerMoteur } from "./moteur";
import { chargerParametres, nombreDepuis } from "./parametres";
import { compterPhotos } from "./photos";
import { leverRupture } from "./ruptures";
import { enregistrerMouvement } from "./stock";
import { validerTacheLiee } from "./taches";

export type EtatLigneReception = (typeof schema.etatLigneReceptionEnum.enumValues)[number];
export type DecisionReception = (typeof schema.decisionReceptionEnum.enumValues)[number];

export const LIBELLE_ETAT_LIGNE: Record<EtatLigneReception, string> = {
  conforme: "Conforme",
  ecart: "Écart",
  non_livre: "Non livré",
  en_plus: "En plus",
};

export const LIBELLE_DECISION: Record<DecisionReception, string> = {
  accepte: "Accepté",
  accepte_reserve: "Accepté avec réserve",
  refuse: "Refusé",
};

/** Fournisseurs à proposer : ceux dont une commande est attendue viennent en tête. */
export async function fournisseursPourReception() {
  const [fournisseurs, attendues] = await Promise.all([
    db.select().from(schema.fournisseurs).where(eq(schema.fournisseurs.statut, "actif")).orderBy(asc(schema.fournisseurs.nom)),
    db
      .select({ fournisseurId: schema.commandes.fournisseurId, dateLivraison: schema.commandes.dateLivraison, id: schema.commandes.id })
      .from(schema.commandes)
      .where(inArray(schema.commandes.statut, ["envoyee", "recue_partiellement"]))
      .orderBy(asc(schema.commandes.dateLivraison)),
  ]);
  const aVerifier = await db.select().from(schema.fournisseurs).where(eq(schema.fournisseurs.statut, "a_verifier")).orderBy(asc(schema.fournisseurs.nom));
  const attenduParF = new Map<number, { commandeId: number; dateLivraison: ISODate }>();
  for (const a of attendues) if (!attenduParF.has(a.fournisseurId)) attenduParF.set(a.fournisseurId, { commandeId: a.id, dateLivraison: a.dateLivraison });
  const tous = [...fournisseurs, ...aVerifier];
  const avec = tous.filter((f) => attenduParF.has(f.id)).map((f) => ({ ...f, attendue: attenduParF.get(f.id)! }));
  const sans = tous.filter((f) => !attenduParF.has(f.id)).map((f) => ({ ...f, attendue: null }));
  return [...avec, ...sans];
}

export async function receptionsDuJour(date: ISODate = journeeExploitation()) {
  return db
    .select({ r: schema.receptions, fournisseur: schema.fournisseurs.nom, prenom: schema.personnes.prenom })
    .from(schema.receptions)
    .innerJoin(schema.fournisseurs, eq(schema.fournisseurs.id, schema.receptions.fournisseurId))
    .leftJoin(schema.personnes, eq(schema.personnes.id, schema.receptions.personneId))
    .where(eq(schema.receptions.date, date))
    .orderBy(desc(schema.receptions.creeLe));
}

export async function historiqueReceptions(limite = 50) {
  return db
    .select({ r: schema.receptions, fournisseur: schema.fournisseurs.nom, prenom: schema.personnes.prenom })
    .from(schema.receptions)
    .innerJoin(schema.fournisseurs, eq(schema.fournisseurs.id, schema.receptions.fournisseurId))
    .leftJoin(schema.personnes, eq(schema.personnes.id, schema.receptions.personneId))
    .orderBy(desc(schema.receptions.creeLe))
    .limit(limite);
}

/** Une réception par livraison : fournisseur et bon de livraison. */
export async function creerReception(
  acteur: Acteur,
  options: { fournisseurId: number; parSuppleant: boolean; achatDirect?: boolean },
): Promise<number> {
  const [f] = await db.select().from(schema.fournisseurs).where(eq(schema.fournisseurs.id, options.fournisseurId));
  if (!f) throw new Error("Fournisseur introuvable.");
  const achatDirect = options.achatDirect ?? f.achatDirect;
  // Commande attendue la plus ancienne de ce fournisseur, si elle existe.
  const [attendue] = achatDirect
    ? []
    : await db
        .select()
        .from(schema.commandes)
        .where(and(eq(schema.commandes.fournisseurId, f.id), inArray(schema.commandes.statut, ["envoyee", "recue_partiellement"])))
        .orderBy(asc(schema.commandes.dateLivraison), asc(schema.commandes.id))
        .limit(1);
  const [r] = await db
    .insert(schema.receptions)
    .values({
      fournisseurId: f.id,
      commandeId: attendue?.id ?? null,
      date: journeeExploitation(),
      posteId: acteur.posteId!,
      personneId: acteur.personneId!,
      parSuppleant: options.parSuppleant,
      achatDirect,
    })
    .returning({ id: schema.receptions.id });
  await journaliser(acteur, "reception", "creer", { entiteId: r.id, apres: { fournisseurId: f.id, commandeId: attendue?.id ?? null, parSuppleant: options.parSuppleant } });
  return r.id;
}

export interface ReceptionVue {
  reception: typeof schema.receptions.$inferSelect;
  fournisseur: typeof schema.fournisseurs.$inferSelect;
  lignes: {
    id: number;
    articleId: number;
    nom: string;
    unite: string;
    estPiece: boolean;
    qteRecue: number;
    qteRefusee: number;
    motifRefus: string | null;
    qteCommandee: number | null;
    etat: EtatLigneReception | null;
    prixHt: number | null;
    tvaPct: number | null;
  }[];
  /** Articles que ce fournisseur livre habituellement (proposés en premier). */
  articlesFournisseur: { id: number; nom: string; unite: string }[];
  nbPhotos: number;
}

export async function receptionVue(receptionId: number): Promise<ReceptionVue | null> {
  const [r] = await db.select().from(schema.receptions).where(eq(schema.receptions.id, receptionId));
  if (!r) return null;
  const [f] = await db.select().from(schema.fournisseurs).where(eq(schema.fournisseurs.id, r.fournisseurId));
  const [lignes, charge, afRows, photos] = await Promise.all([
    db.select().from(schema.receptionLignes).where(eq(schema.receptionLignes.receptionId, receptionId)).orderBy(asc(schema.receptionLignes.id)),
    chargerMoteur(),
    db.select().from(schema.articleFournisseurs).where(and(eq(schema.articleFournisseurs.fournisseurId, r.fournisseurId), eq(schema.articleFournisseurs.actif, true))),
    compterPhotos("reception", [receptionId]),
  ]);
  return {
    reception: r,
    fournisseur: f,
    lignes: lignes.map((l) => {
      const a = charge.articles.get(l.articleId);
      return {
        id: l.id,
        articleId: l.articleId,
        nom: a?.nom ?? `Article ${l.articleId}`,
        unite: a?.uniteComptage ?? "",
        estPiece: a?.estPiece ?? false,
        qteRecue: Number(l.qteRecue),
        qteRefusee: Number(l.qteRefusee),
        motifRefus: l.motifRefus,
        qteCommandee: l.qteCommandee === null ? null : Number(l.qteCommandee),
        etat: l.etat,
        prixHt: l.prixHt === null ? null : Number(l.prixHt),
        tvaPct: l.tvaPct === null ? null : Number(l.tvaPct),
      };
    }),
    articlesFournisseur: afRows
      .map((af) => charge.articles.get(af.articleId))
      .filter((a): a is NonNullable<typeof a> => !!a && a.statut !== "archive")
      .map((a) => ({ id: a.id, nom: a.nom, unite: a.uniteComptage }))
      .sort((x, y) => x.nom.localeCompare(y.nom, "fr")),
    nbPhotos: photos.get(receptionId) ?? 0,
  };
}

async function exigerBrouillon(receptionId: number) {
  const [r] = await db.select().from(schema.receptions).where(eq(schema.receptions.id, receptionId));
  if (!r) throw new Error("Réception introuvable.");
  if (r.statut !== "brouillon") throw new Error("Une réception validée ne se modifie plus. Faites une réception rectificative.");
  return r;
}

/** Les quantités commandées ne sont jamais affichées avant la validation : on ne stocke ici que le reçu. */
export async function saisirLigneReception(
  acteur: Acteur,
  receptionId: number,
  articleId: number,
  valeurs: { qteRecue?: number | null; qteRefusee?: number | null; motifRefus?: string | null; prixHt?: number | null; tvaPct?: number | null },
): Promise<void> {
  await exigerBrouillon(receptionId);
  const set: Partial<typeof schema.receptionLignes.$inferInsert> = { saisiLe: new Date() };
  if (valeurs.qteRecue !== undefined) set.qteRecue = String(Math.max(0, valeurs.qteRecue ?? 0));
  if (valeurs.qteRefusee !== undefined) set.qteRefusee = String(Math.max(0, valeurs.qteRefusee ?? 0));
  if (valeurs.motifRefus !== undefined) set.motifRefus = valeurs.motifRefus?.trim() || null;
  if (valeurs.prixHt !== undefined) set.prixHt = valeurs.prixHt === null ? null : String(valeurs.prixHt);
  if (valeurs.tvaPct !== undefined) set.tvaPct = valeurs.tvaPct === null ? null : String(valeurs.tvaPct);
  await db
    .insert(schema.receptionLignes)
    .values({ receptionId, articleId, qteRecue: set.qteRecue ?? "0", qteRefusee: set.qteRefusee ?? "0", motifRefus: set.motifRefus ?? null, prixHt: set.prixHt ?? null, tvaPct: set.tvaPct ?? null })
    .onConflictDoUpdate({ target: [schema.receptionLignes.receptionId, schema.receptionLignes.articleId], set });
  void acteur;
}

export async function retirerLigneReception(receptionId: number, articleId: number): Promise<void> {
  await exigerBrouillon(receptionId);
  await db.delete(schema.receptionLignes).where(and(eq(schema.receptionLignes.receptionId, receptionId), eq(schema.receptionLignes.articleId, articleId)));
}

export async function saisirControles(
  acteur: Acteur,
  receptionId: number,
  c: {
    temperature?: number | null;
    dlcOk?: boolean | null;
    emballagesOk?: boolean | null;
    aspectOk?: boolean | null;
    decision?: DecisionReception | null;
    reserve?: string | null;
    montantPaye?: number | null;
  },
): Promise<void> {
  await exigerBrouillon(receptionId);
  await db
    .update(schema.receptions)
    .set({
      temperature: c.temperature === undefined ? undefined : c.temperature === null ? null : String(c.temperature),
      dlcOk: c.dlcOk,
      emballagesOk: c.emballagesOk,
      aspectOk: c.aspectOk,
      decision: c.decision,
      reserve: c.reserve === undefined ? undefined : c.reserve?.trim() || null,
      montantPaye: c.montantPaye === undefined ? undefined : c.montantPaye === null ? null : String(c.montantPaye),
    })
    .where(eq(schema.receptions.id, receptionId));
  void acteur;
}

async function enregistrerPrixDepuisReception(
  tx: Tx,
  acteur: Acteur,
  r: typeof schema.receptions.$inferSelect,
  l: typeof schema.receptionLignes.$inferSelect,
  nomArticle: string,
  structurant: boolean,
): Promise<void> {
  if (l.prixHt === null) return;
  let [af] = await tx
    .select()
    .from(schema.articleFournisseurs)
    .where(and(eq(schema.articleFournisseurs.articleId, l.articleId), eq(schema.articleFournisseurs.fournisseurId, r.fournisseurId)));
  if (!af) {
    const [a] = await tx.select().from(schema.articles).where(eq(schema.articles.id, l.articleId));
    [af] = await tx
      .insert(schema.articleFournisseurs)
      .values({ articleId: l.articleId, fournisseurId: r.fournisseurId, uniteCommande: a?.uniteComptage ?? "unité", qteParUniteCommande: "1" })
      .returning();
  }
  const [precedent] = await tx
    .select()
    .from(schema.prix)
    .where(eq(schema.prix.articleFournisseurId, af.id))
    .orderBy(desc(schema.prix.date), desc(schema.prix.id))
    .limit(1);
  await tx.insert(schema.prix).values({
    articleFournisseurId: af.id,
    prixHt: l.prixHt,
    tvaPct: l.tvaPct ?? "0",
    date: r.date,
    saisiParPosteId: acteur.posteId,
    saisiParPersonneId: acteur.personneId,
  });
  if (structurant && precedent) {
    const p = await chargerParametres();
    const seuil = nombreDepuis(p, "seuil_hausse_prix");
    const ancien = Number(precedent.prixHt);
    const nouveau = Number(l.prixHt);
    if (ancien > 0 && (nouveau - ancien) / ancien > seuil) {
      const autres = await tx
        .select({ fournisseur: schema.fournisseurs.nom, prixHt: schema.prix.prixHt, date: schema.prix.date, afId: schema.articleFournisseurs.id })
        .from(schema.prix)
        .innerJoin(schema.articleFournisseurs, eq(schema.articleFournisseurs.id, schema.prix.articleFournisseurId))
        .innerJoin(schema.fournisseurs, eq(schema.fournisseurs.id, schema.articleFournisseurs.fournisseurId))
        .where(eq(schema.articleFournisseurs.articleId, l.articleId))
        .orderBy(desc(schema.prix.date));
      const vus = new Set<number>();
      const comparaison = autres
        .filter((x) => {
          if (x.afId === af.id || vus.has(x.afId)) return false;
          vus.add(x.afId);
          return true;
        })
        .map((x) => `${x.fournisseur} : ${Number(x.prixHt).toFixed(2)} DH (${x.date})`)
        .join(" ; ");
      await creerAlerte(
        {
          type: "hausse_prix",
          niveau: "avertissement",
          titre: `Hausse de prix : ${nomArticle}`,
          detail: `${ancien.toFixed(2)} → ${nouveau.toFixed(2)} DH HT (+${(((nouveau - ancien) / ancien) * 100).toFixed(1)} %) chez ce fournisseur.${comparaison ? ` Autres fournisseurs : ${comparaison}.` : ""}`,
          objetType: "reception",
          objetId: r.id,
          roles: ["proprietaire"],
        },
        tx,
      );
    }
  }
}

/**
 * Validation : au moins un article, toutes les quantités, au moins une photo du bon.
 * Compare ensuite au commandé, met le stock à jour, signale les écarts et lève les ruptures.
 */
export async function validerReception(acteur: Acteur, receptionId: number): Promise<{ ok: true; lignes: ReceptionVue["lignes"] } | { ok: false; erreur: string }> {
  const r = await exigerBrouillon(receptionId);
  const lignes = await db.select().from(schema.receptionLignes).where(eq(schema.receptionLignes.receptionId, receptionId));
  if (lignes.length === 0) return { ok: false, erreur: "Ajoutez au moins un article." };
  const nbPhotos = (await compterPhotos("reception", [receptionId])).get(receptionId) ?? 0;
  if (nbPhotos === 0) return { ok: false, erreur: "La photo du bon de livraison est obligatoire." };
  if (!r.decision) return { ok: false, erreur: "Indiquez la décision : accepté, avec réserve ou refusé." };
  const charge = await chargerMoteur();
  const [fournisseur] = await db.select().from(schema.fournisseurs).where(eq(schema.fournisseurs.id, r.fournisseurId));
  const commandeLignes = r.commandeId
    ? await db.select().from(schema.commandeLignes).where(eq(schema.commandeLignes.commandeId, r.commandeId))
    : [];
  const anomalies: string[] = [];
  const manquants: { articleId: number; nom: string; manque: number; unite: string }[] = [];
  const maintenant = new Date();
  await db.transaction(async (tx) => {
    // Réception rectificative : on annule d'abord les mouvements de la réception d'origine.
    if (r.rectifieId) {
      const origine = await tx.select().from(schema.receptionLignes).where(eq(schema.receptionLignes.receptionId, r.rectifieId));
      for (const o of origine) {
        const net = Number(o.qteRecue) - Number(o.qteRefusee);
        if (net === 0) continue;
        await enregistrerMouvement(tx, {
          articleId: o.articleId,
          nature: "correction",
          quantite: -net,
          origineType: "reception_rectificative",
          origineId: receptionId,
          posteId: acteur.posteId,
          personneId: acteur.personneId,
          note: `Annule la réception n° ${r.rectifieId}`,
          at: maintenant,
        });
      }
    }
    const vus = new Set<number>();
    for (const l of lignes) {
      vus.add(l.articleId);
      const a = charge.articles.get(l.articleId);
      const nom = a?.nom ?? `Article ${l.articleId}`;
      const unite = a?.uniteComptage ?? "";
      const recue = Number(l.qteRecue);
      const refusee = Number(l.qteRefusee);
      const entree = Math.max(0, recue - refusee);
      const cl = commandeLignes.find((c) => c.articleId === l.articleId);
      let etat: EtatLigneReception;
      let qteCommandee: number | null = null;
      if (cl) {
        qteCommandee = Number(cl.qteComptage) - Number(cl.qteRecue);
        etat = Math.abs(recue - qteCommandee) < 1e-6 ? "conforme" : "ecart";
        await tx
          .update(schema.commandeLignes)
          .set({ qteRecue: String(Number(cl.qteRecue) + recue) })
          .where(eq(schema.commandeLignes.id, cl.id));
        if (recue < qteCommandee - 1e-6) {
          anomalies.push(`${nom} : reçu ${recue} ${unite} sur ${qteCommandee} commandés`);
          manquants.push({ articleId: l.articleId, nom, manque: qteCommandee - recue, unite });
        } else if (recue > qteCommandee + 1e-6) {
          anomalies.push(`${nom} : reçu ${recue} ${unite} pour ${qteCommandee} commandés`);
        }
      } else {
        etat = r.commandeId ? "en_plus" : "conforme";
        if (r.commandeId) anomalies.push(`${nom} : en plus (${recue} ${unite}), absent de la commande`);
      }
      if (refusee > 0) anomalies.push(`${nom} : ${refusee} ${unite} refusés (${l.motifRefus ?? "sans motif"})`);
      await tx
        .update(schema.receptionLignes)
        .set({ etat, qteCommandee: qteCommandee === null ? null : String(qteCommandee) })
        .where(eq(schema.receptionLignes.id, l.id));
      if (entree > 0) {
        await enregistrerMouvement(tx, {
          articleId: l.articleId,
          nature: "reception",
          quantite: entree,
          origineType: "reception",
          origineId: receptionId,
          posteId: acteur.posteId,
          personneId: acteur.personneId,
          note: fournisseur?.nom ?? null,
          at: maintenant,
        });
        await leverRupture(l.articleId, tx);
      }
      await enregistrerPrixDepuisReception(tx, acteur, r, l, nom, a?.structurant ?? false);
    }
    // Articles commandés, absents de la réception : non livrés.
    for (const cl of commandeLignes) {
      if (vus.has(cl.articleId)) continue;
      const restant = Number(cl.qteComptage) - Number(cl.qteRecue);
      if (restant <= 1e-6) continue;
      const a = charge.articles.get(cl.articleId);
      const nom = a?.nom ?? `Article ${cl.articleId}`;
      await tx.insert(schema.receptionLignes).values({
        receptionId,
        articleId: cl.articleId,
        qteRecue: "0",
        qteRefusee: "0",
        qteCommandee: String(restant),
        etat: "non_livre",
      });
      anomalies.push(`${nom} : non livré (${restant} ${a?.uniteComptage ?? ""} commandés)`);
      manquants.push({ articleId: cl.articleId, nom, manque: restant, unite: a?.uniteComptage ?? "" });
    }
    // État de la commande.
    if (r.commandeId) {
      const lignesMaj = await tx.select().from(schema.commandeLignes).where(eq(schema.commandeLignes.commandeId, r.commandeId));
      const complete = lignesMaj.every((c) => Number(c.qteRecue) >= Number(c.qteComptage) - 1e-6);
      await tx
        .update(schema.commandes)
        .set({ statut: complete ? "recue" : "recue_partiellement", modifieLe: maintenant })
        .where(eq(schema.commandes.id, r.commandeId));
    }
    await tx.update(schema.receptions).set({ statut: "validee", valideeLe: maintenant }).where(eq(schema.receptions.id, receptionId));
    // Les manques reviennent dans les lignes à commander, à confirmer par la responsable achats.
    for (const m of manquants) {
      const [af] = await tx
        .select()
        .from(schema.articleFournisseurs)
        .where(and(eq(schema.articleFournisseurs.articleId, m.articleId), eq(schema.articleFournisseurs.fournisseurId, r.fournisseurId)));
      const qteUnite = Number(af?.qteParUniteCommande ?? 1) || 1;
      await ajouterLigneManuelle(acteur, r.fournisseurId, m.articleId, Math.ceil(m.manque / qteUnite - 1e-9), "reception", tx);
    }
    if (anomalies.length > 0) {
      await creerAlerte(
        {
          type: "ecart_reception",
          niveau: "avertissement",
          titre: `Écart de réception : ${fournisseur?.nom ?? ""}`,
          detail: anomalies.join(" ; "),
          objetType: "reception",
          objetId: receptionId,
          roles: ["proprietaire", "resp_achats"],
        },
        tx,
      );
    }
    if (r.decision === "refuse") {
      await creerAlerte(
        {
          type: "ecart_reception",
          niveau: "avertissement",
          titre: `Livraison refusée : ${fournisseur?.nom ?? ""}`,
          detail: r.reserve ?? null,
          objetType: "reception",
          objetId: receptionId,
          roles: ["proprietaire", "resp_achats"],
        },
        tx,
      );
    }
    await journaliser(acteur, "reception", "valider", { entiteId: receptionId, apres: { lignes: lignes.length, anomalies }, tx });
  });
  await validerTacheLiee(acteur, "reception");
  const vue = await receptionVue(receptionId);
  return { ok: true, lignes: vue?.lignes ?? [] };
}

/** Une erreur se corrige par une réception rectificative, avec un motif, visible des propriétaires. */
export async function creerRectificative(acteur: Acteur, originaleId: number, motif: string): Promise<number> {
  const [o] = await db.select().from(schema.receptions).where(eq(schema.receptions.id, originaleId));
  if (!o || o.statut !== "validee") throw new Error("Seule une réception validée se rectifie.");
  if (!motif.trim()) throw new Error("Le motif est obligatoire.");
  const lignes = await db.select().from(schema.receptionLignes).where(eq(schema.receptionLignes.receptionId, originaleId));
  const id = await db.transaction(async (tx) => {
    const [r] = await tx
      .insert(schema.receptions)
      .values({
        fournisseurId: o.fournisseurId,
        commandeId: null,
        date: journeeExploitation(),
        posteId: acteur.posteId!,
        personneId: acteur.personneId!,
        parSuppleant: false,
        achatDirect: o.achatDirect,
        rectifieId: originaleId,
        motifRectification: motif.trim(),
        temperature: o.temperature,
        dlcOk: o.dlcOk,
        emballagesOk: o.emballagesOk,
        aspectOk: o.aspectOk,
        decision: o.decision,
      })
      .returning({ id: schema.receptions.id });
    for (const l of lignes) {
      if (l.etat === "non_livre") continue;
      await tx.insert(schema.receptionLignes).values({ receptionId: r.id, articleId: l.articleId, qteRecue: l.qteRecue, qteRefusee: l.qteRefusee, motifRefus: l.motifRefus });
    }
    await creerAlerte(
      {
        type: "ecart_reception",
        niveau: "information",
        titre: `Réception rectificative n° ${r.id}`,
        detail: `Corrige la réception n° ${originaleId} : ${motif.trim()}`,
        objetType: "reception",
        objetId: r.id,
        roles: ["proprietaire"],
      },
      tx,
    );
    await journaliser(acteur, "reception", "rectifier", { entiteId: r.id, apres: { originaleId, motif }, tx });
    return r.id;
  });
  return id;
}

/** Commandes envoyées pour aujourd'hui sans réception à l'heure limite : alerte à la manager, puis aux propriétaires. */
export async function alerterLivraisonsNonReceptionnees(maintenant = new Date()): Promise<number> {
  const p = await chargerParametres();
  const heureLimite = p.heure_limite_reception ?? "12:00";
  const aujourdHui = journeeExploitation(maintenant);
  const { heureLocale } = await import("@/lib/dates");
  const h = heureLocale(maintenant);
  if (h < heureLimite) return 0;
  const attendues = await db
    .select({ c: schema.commandes, fournisseur: schema.fournisseurs.nom })
    .from(schema.commandes)
    .innerJoin(schema.fournisseurs, eq(schema.fournisseurs.id, schema.commandes.fournisseurId))
    .where(and(eq(schema.commandes.statut, "envoyee"), eq(schema.commandes.dateLivraison, aujourdHui)));
  let n = 0;
  for (const { c, fournisseur } of attendues) {
    const [rec] = await db
      .select({ id: schema.receptions.id })
      .from(schema.receptions)
      .where(and(eq(schema.receptions.commandeId, c.id), isNull(schema.receptions.rectifieId)))
      .limit(1);
    if (rec) continue;
    const tardif = h >= ajouterHeure(heureLimite, 2);
    await creerAlerte({
      type: "livraison_non_receptionnee",
      niveau: "avertissement",
      titre: `Livraison non réceptionnée : ${fournisseur}`,
      detail: `Commande n° ${c.id} attendue aujourd'hui, aucune réception saisie à ${h}.`,
      objetType: "commande",
      objetId: c.id,
      roles: tardif ? ["manager", "proprietaire"] : ["manager"],
      cleUnique: `livraison_non_rec:${c.id}:${tardif ? "proprietaires" : "manager"}`,
    });
    n++;
  }
  return n;
}

function ajouterHeure(hhmm: string, heures: number): string {
  const [h, m] = hhmm.split(":").map(Number);
  const t = Math.min(23, h + heures);
  return `${String(t).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
