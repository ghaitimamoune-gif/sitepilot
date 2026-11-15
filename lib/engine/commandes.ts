/**
 * Calcul des commandes fournisseurs (section 8) : dates de livraison,
 * jours couverts et quantité à commander. Pur, testé dans tests/commandes.test.ts.
 */
import { ajouterJours, joursEntre, jourSemaine, type ISODate } from "@/lib/dates";
import { Calendrier } from "./calendrier";
import { arrondiConditionnement, Moteur } from "./moteur";

export interface FournisseurLivraison {
  /** 0 = dimanche ... 6 = samedi. Vide : tous les jours. */
  joursLivraison: number[];
  /** Délai minimal entre la commande et la livraison, en jours (1 : commandé la veille). */
  delaiJours: number;
  /** Heure limite de commande « HH:MM ». */
  heureLimite?: string | null;
}

const HORIZON = 45;

function livreCeJour(f: FournisseurLivraison, cal: Calendrier, d: ISODate): boolean {
  if (!cal.estOuvert(d)) return false;
  if (f.joursLivraison.length === 0) return true;
  return f.joursLivraison.includes(jourSemaine(d));
}

/**
 * Première livraison possible pour une commande passée le jour `dateCommande`.
 * Si l'heure limite est dépassée, la commande est traitée comme passée le lendemain.
 */
export function prochaineLivraison(
  f: FournisseurLivraison,
  cal: Calendrier,
  dateCommande: ISODate,
  apresHeureLimite = false,
): ISODate | null {
  const base = apresHeureLimite ? ajouterJours(dateCommande, 1) : dateCommande;
  const delai = Math.max(1, f.delaiJours || 1);
  for (let i = delai; i <= HORIZON; i++) {
    const d = ajouterJours(base, i);
    if (livreCeJour(f, cal, d)) return d;
  }
  return null;
}

/** Première livraison possible strictement après `apres` (sans contrainte de délai). */
export function livraisonSuivante(f: FournisseurLivraison, cal: Calendrier, apres: ISODate): ISODate | null {
  for (let i = 1; i <= HORIZON; i++) {
    const d = ajouterJours(apres, i);
    if (livreCeJour(f, cal, d)) return d;
  }
  return null;
}

export interface ArticleCouverture {
  dlcJours: number | null;
  joursSecurite: number;
}

/**
 * Jours de service couverts par une livraison : de la livraison à la veille de la
 * livraison suivante, bornés par la DLC, plus les jours de sécurité. Aucune
 * sécurité au-delà d'une veille de fermeture pour un produit court.
 */
export function joursCouverts(
  article: ArticleCouverture,
  cal: Calendrier,
  dateLivraison: ISODate,
  livraisonSuivante: ISODate | null,
  seuilDlcVeilleFermeture = 2,
): { jours: ISODate[]; joursSecurite: ISODate[] } {
  const dlc = article.dlcJours ?? Number.POSITIVE_INFINITY;
  const dansDlc = (d: ISODate) => joursEntre(dateLivraison, d) < dlc;
  const fin = livraisonSuivante ? ajouterJours(livraisonSuivante, -1) : ajouterJours(dateLivraison, 13);
  const jours = cal.joursOuvertsEntre(dateLivraison, fin).filter(dansDlc);
  if (jours.length === 0) {
    // Produit livré pour une journée seulement, ou jour de livraison fermé : au moins le premier jour ouvert.
    const premier = cal.estOuvert(dateLivraison) ? dateLivraison : cal.prochainJourOuvert(dateLivraison);
    jours.push(premier);
  }
  const dernier = jours[jours.length - 1];
  const securite: ISODate[] = [];
  const produitCourt = article.dlcJours !== null && article.dlcJours <= seuilDlcVeilleFermeture;
  if (!(produitCourt && cal.estVeilleFermeture(dernier))) {
    let d = dernier;
    while (securite.length < article.joursSecurite) {
      d = cal.prochainJourOuvert(d);
      if (!dansDlc(d)) break;
      securite.push(d);
    }
  }
  return { jours, joursSecurite: securite };
}

export interface PropositionCommande {
  dateLivraison: ISODate;
  livraisonSuivante: ISODate | null;
  jours: ISODate[];
  joursSecurite: ISODate[];
  besoin: number;
  stockActuel: number;
  consommationAvantLivraison: number;
  enCommande: number;
  disponible: number;
  aCommanderComptage: number;
  aCommanderUnites: number;
}

/**
 * Quantité proposée pour un article auprès d'un fournisseur (formule de la section 8).
 * Toutes les quantités en unité de comptage, sauf `aCommanderUnites` (unité de commande).
 */
export function proposerQuantite(params: {
  moteur: Moteur;
  articleId: number;
  fournisseur: FournisseurLivraison;
  dateCommande: ISODate;
  apresHeureLimite?: boolean;
  stockActuel: number;
  enCommande: number;
  qteParUniteCommande: number;
  seuilDlcVeilleFermeture?: number;
}): PropositionCommande | null {
  const { moteur, articleId, fournisseur, dateCommande, stockActuel, enCommande } = params;
  const cal = moteur.calendrier;
  const dateLivraison = prochaineLivraison(fournisseur, cal, dateCommande, params.apresHeureLimite ?? false);
  if (!dateLivraison) return null;
  const suivante = livraisonSuivante(fournisseur, cal, dateLivraison);
  const a = moteur.article(articleId);
  const { jours, joursSecurite } = joursCouverts(
    { dlcJours: a.dlcJours, joursSecurite: a.joursSecurite },
    cal,
    dateLivraison,
    suivante,
    params.seuilDlcVeilleFermeture ?? 2,
  );
  const besoin = moteur.besoinSurJours(articleId, [...jours, ...joursSecurite]);
  // Consommation prévue d'ici la livraison : les jours de service d'aujourd'hui à la veille de la livraison.
  const joursAvant = cal.joursOuvertsEntre(dateCommande, ajouterJours(dateLivraison, -1));
  const consommationAvantLivraison = moteur.besoinSurJours(articleId, joursAvant);
  const disponible = stockActuel - consommationAvantLivraison + enCommande;
  const aCommanderComptage = Math.max(0, besoin - disponible);
  const aCommanderUnites = arrondiConditionnement(aCommanderComptage, params.qteParUniteCommande);
  return {
    dateLivraison,
    livraisonSuivante: suivante,
    jours,
    joursSecurite,
    besoin,
    stockActuel,
    consommationAvantLivraison,
    enCommande,
    disponible,
    aCommanderComptage,
    aCommanderUnites,
  };
}

/** Quantité pour un article sans lien avec les ventes : stock minimum et stock cible fixes. */
export function proposerQuantiteFixe(params: {
  stockActuel: number;
  enCommande: number;
  stockMinimum: number | null;
  stockCible: number | null;
  qteParUniteCommande: number;
}): { aCommanderComptage: number; aCommanderUnites: number; sousMinimum: boolean } {
  const { stockActuel, enCommande, stockMinimum, stockCible } = params;
  const disponible = stockActuel + enCommande;
  const minimum = stockMinimum ?? 0;
  const sousMinimum = disponible < minimum;
  if (!sousMinimum) return { aCommanderComptage: 0, aCommanderUnites: 0, sousMinimum };
  const cible = Math.max(stockCible ?? minimum, minimum);
  const aCommanderComptage = Math.max(0, cible - disponible);
  return {
    aCommanderComptage,
    aCommanderUnites: arrondiConditionnement(aCommanderComptage, params.qteParUniteCommande),
    sousMinimum,
  };
}
