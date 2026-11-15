/**
 * Moteur de calcul des préparations, des stocks cibles et des besoins.
 *
 * Implémentation des six étapes de la section 6 du brief. Le classeur
 * EasyBurger_Quantites.xlsx est la référence ; les jeux d'essai de la
 * section 16 sont rejoués dans tests/moteur.test.ts.
 *
 * Tout est pur : aucune lecture en base, aucun arrondi intermédiaire.
 */
import type { ISODate } from "@/lib/dates";
import { Calendrier } from "./calendrier";
import type {
  ArticleMoteur,
  DonneesMoteur,
  FichePreparation,
  JourPrevu,
  LigneNomenclature,
  LigneRecette,
  ProduitMoteur,
  StockCible,
} from "./types";

export type Previsionniste = (date: ISODate) => JourPrevu;

export class Moteur {
  private readonly produits = new Map<number, ProduitMoteur>();
  private readonly articles = new Map<number, ArticleMoteur>();
  /** Nomenclature indexée par article composant. */
  private readonly composantDe = new Map<number, LigneNomenclature[]>();
  /** Recettes indexées par ingrédient : dans quelles préparations entre-t-il ? */
  private readonly ingredientDe = new Map<number, LigneRecette[]>();
  /** Recettes indexées par préparation. */
  private readonly recetteDe = new Map<number, LigneRecette[]>();
  private readonly memoTotal = new Map<string, number>();
  private readonly enCours = new Set<string>();

  constructor(
    private readonly donnees: DonneesMoteur,
    readonly calendrier: Calendrier,
    private readonly prevision: Previsionniste,
  ) {
    for (const p of donnees.produits) this.produits.set(p.id, p);
    for (const a of donnees.articles) this.articles.set(a.id, a);
    for (const l of donnees.nomenclature) {
      const arr = this.composantDe.get(l.articleId) ?? [];
      arr.push(l);
      this.composantDe.set(l.articleId, arr);
    }
    for (const r of donnees.recettes) {
      const arr = this.ingredientDe.get(r.ingredientId) ?? [];
      arr.push(r);
      this.ingredientDe.set(r.ingredientId, arr);
      const arr2 = this.recetteDe.get(r.preparationId) ?? [];
      arr2.push(r);
      this.recetteDe.set(r.preparationId, arr2);
    }
  }

  article(id: number): ArticleMoteur {
    const a = this.articles.get(id);
    if (!a) throw new Error(`Article inconnu dans le moteur : ${id}`);
    return a;
  }

  get margeGenerale(): number {
    return this.donnees.margeGenerale;
  }

  jour(date: ISODate): JourPrevu {
    return this.prevision(date);
  }

  // Étape 1 : ventes prévues d'un produit (non arrondies).
  unitesVendues(produitId: number, date: ISODate): number {
    const p = this.produits.get(produitId);
    if (!p) return 0;
    const j = this.prevision(date);
    const coef = p.coefficients[j.type] ?? 0;
    return (coef * j.ca) / 1000;
  }

  /** Détail des ventes prévues qui consomment un article, par produit. */
  detailVentes(articleId: number, date: ISODate): { produitId: number; nom: string; unites: number; quantite: number }[] {
    return (this.composantDe.get(articleId) ?? []).map((l) => {
      const unites = this.unitesVendues(l.produitId, date);
      return {
        produitId: l.produitId,
        nom: this.produits.get(l.produitId)?.nom ?? String(l.produitId),
        unites,
        quantite: unites * l.quantite,
      };
    });
  }

  // Étape 2 : besoin net d'un composant.
  besoinNet(articleId: number, date: ISODate): number {
    let net = 0;
    for (const l of this.composantDe.get(articleId) ?? []) {
      net += this.unitesVendues(l.produitId, date) * l.quantite;
    }
    return net;
  }

  // Étape 3 : besoin brut (marge générale et perte de la famille).
  besoinBrutDirect(articleId: number, date: ISODate): number {
    const net = this.besoinNet(articleId, date);
    if (net === 0) return 0;
    const a = this.article(articleId);
    return (net * (1 + this.donnees.margeGenerale)) / (1 - a.pertePct);
  }

  /**
   * Besoin total d'un article un jour donné : besoin brut direct (nomenclature)
   * plus ce qu'en consomment les préparations maison dont il est un ingrédient
   * (étape 5, proportionnel, sans arrondi au batch).
   */
  besoinTotal(articleId: number, date: ISODate): number {
    const cle = `${articleId}|${date}`;
    const memo = this.memoTotal.get(cle);
    if (memo !== undefined) return memo;
    if (this.enCours.has(cle)) throw new Error(`Recette circulaire autour de l'article ${articleId}`);
    this.enCours.add(cle);
    let total = this.besoinBrutDirect(articleId, date);
    for (const r of this.ingredientDe.get(articleId) ?? []) {
      const prep = this.article(r.preparationId);
      const besoinPrep = this.besoinTotal(r.preparationId, date);
      const rendement = prep.rendementBatch && prep.rendementBatch > 0 ? prep.rendementBatch : 1;
      total += (besoinPrep / rendement) * r.quantiteParBatch;
    }
    this.enCours.delete(cle);
    this.memoTotal.set(cle, total);
    return total;
  }

  /** Besoin à l'achat : brut divisé par le rendement de parage. */
  besoinAchat(articleId: number, date: ISODate): number {
    const a = this.article(articleId);
    const total = this.besoinTotal(articleId, date);
    if (a.rendementParage && a.rendementParage > 0) return total / a.rendementParage;
    return total;
  }

  /** Ingrédients d'une préparation pour un besoin donné (étape 5). */
  ingredients(preparationId: number, besoin: number): { ingredientId: number; nom: string; quantite: number; unite: string }[] {
    const prep = this.article(preparationId);
    const rendement = prep.rendementBatch && prep.rendementBatch > 0 ? prep.rendementBatch : 1;
    return (this.recetteDe.get(preparationId) ?? []).map((r) => {
      const ing = this.article(r.ingredientId);
      return {
        ingredientId: r.ingredientId,
        nom: ing.nom,
        quantite: (besoin / rendement) * r.quantiteParBatch,
        unite: ing.uniteComptage,
      };
    });
  }

  private avanceSupprimee(a: ArticleMoteur, date: ISODate): boolean {
    return (
      this.calendrier.estVeilleFermeture(date) &&
      a.dlcJours !== null &&
      a.dlcJours <= this.donnees.seuilDlcVeilleFermeture
    );
  }

  // Étape 4 : préparation du jour.
  preparationDuJour(
    articleId: number,
    date: ISODate,
    resteVeille = 0,
    forcee: number | null = null,
  ): FichePreparation {
    const a = this.article(articleId);
    const N = this.calendrier.prochainJourOuvert(date);
    const aujourdHui = this.besoinTotal(articleId, date);
    const supprimee = this.avanceSupprimee(a, date);
    const avance = supprimee ? 0 : (a.partAvance ?? 0) * this.besoinTotal(articleId, N);
    const total = aujourdHui + avance;
    const aPreparerCalcule = Math.max(0, total - resteVeille);
    const aPreparer = forcee !== null ? Math.max(0, forcee) : aPreparerCalcule;
    const batchs =
      a.rendementBatch && a.rendementBatch > 0 ? Math.ceil(aPreparer / a.rendementBatch - 1e-9) : null;
    const equivalent =
      a.poidsUnitaire && a.unitePoids ? { valeur: aujourdHui * a.poidsUnitaire, unite: a.unitePoids } : null;
    return {
      articleId,
      nom: a.nom,
      unite: a.uniteComptage,
      estPiece: a.estPiece,
      aujourdHui,
      equivalent,
      avance,
      avanceSupprimee: supprimee,
      total,
      resteVeille,
      aPreparerCalcule,
      aPreparer,
      forcee,
      batchs,
      rendementBatch: a.rendementBatch,
    };
  }

  /** Fiche complète d'un jour : toutes les préparations maison qui ont une part d'avance définie. */
  fichePreparations(
    date: ISODate,
    saisies: Map<number, { resteVeille?: number | null; forcee?: number | null }> = new Map(),
  ): FichePreparation[] {
    return this.donnees.articles
      .filter((a) => a.nature === "preparation" && a.partAvance !== null)
      .map((a) => {
        const s = saisies.get(a.id);
        return this.preparationDuJour(a.id, date, s?.resteVeille ?? 0, s?.forcee ?? null);
      });
  }

  /** Nombre de jours de couverture (étape 6). */
  couverture(articleId: number, date: ISODate, joursJusquaProchaineLivraison: number): number {
    const a = this.article(articleId);
    if (this.avanceSupprimee(a, date)) return 1;
    const dlc = a.dlcJours ?? Number.POSITIVE_INFINITY;
    return Math.max(1, Math.min(dlc, joursJusquaProchaineLivraison + a.joursSecurite));
  }

  // Étape 6 : stock cible d'un article le matin de `date`.
  stockCible(articleId: number, date: ISODate, joursJusquaProchaineLivraison: number): StockCible {
    const couverture = this.couverture(articleId, date, joursJusquaProchaineLivraison);
    const jours = this.calendrier.joursOuverts(date, couverture);
    let cible = 0;
    for (const d of jours) cible += this.besoinAchat(articleId, d);
    return { articleId, besoinJour: this.besoinAchat(articleId, date), couverture, jours, cible };
  }

  /** Besoin d'achat cumulé sur une liste de jours. */
  besoinSurJours(articleId: number, jours: ISODate[]): number {
    let s = 0;
    for (const d of jours) s += this.besoinAchat(articleId, d);
    return s;
  }
}

/** Arrondi d'affichage : pièces à l'entier supérieur, poids et volumes à une décimale vers le haut. */
export function arrondiAffichage(valeur: number, estPiece: boolean): number {
  if (!Number.isFinite(valeur)) return 0;
  const eps = 1e-9;
  const r = estPiece ? Math.ceil(valeur - eps) : Math.ceil(valeur * 10 - eps) / 10;
  return r === 0 ? 0 : r; // jamais « -0 »
}

/** Arrondi au conditionnement supérieur. */
export function arrondiConditionnement(quantiteComptage: number, qteParUniteCommande: number): number {
  if (quantiteComptage <= 0) return 0;
  const q = qteParUniteCommande > 0 ? qteParUniteCommande : 1;
  return Math.ceil(quantiteComptage / q - 1e-9);
}
