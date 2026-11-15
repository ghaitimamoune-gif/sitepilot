/**
 * Lecture des fichiers de ventes de lacaisse.ma (section 13 du brief). Partie pure, testée.
 *
 * Format 1 : rapport détaillé des ventes (.xlsx), feuille EXPORT DES VENTES, une ligne par
 * article de ticket. La feuille SYNTHESE porte le CA TTC de la période, qui sert de contrôle.
 * Format 2 : ventes par produit (.csv), séparateur point-virgule : Produit;Détail;Quantité;Tickets;Montant.
 */
import type { ISODate } from "@/lib/dates";

export interface LigneBrute {
  date: string | Date | number | null | undefined;
  heure: string | Date | number | null | undefined;
  ticket: string | number | null | undefined;
  categorie: string | null | undefined;
  produit: string | null | undefined;
  quantite: string | number | null | undefined;
  prix: string | number | null | undefined;
  typeVente: string | null | undefined;
}

export type StatutLigne = "produit" | "menu" | "option" | "retire" | "inconnu" | "vide";

export interface LigneAnalysee {
  date: ISODate;
  heure: string | null;
  ticket: string | null;
  categorie: string | null;
  libelle: string;
  libelleNorm: string;
  produitId: number | null;
  quantite: number;
  montant: number;
  typeVente: string | null;
  statut: StatutLigne;
}

export interface AnalyseRapport {
  ok: boolean;
  erreur: string | null;
  lignes: LigneAnalysee[];
  parJour: Map<ISODate, number>;
  total: number;
  totalSynthese: number | null;
  inconnus: Map<string, { quantite: number; montant: number }>;
  nbIgnorees: number;
}

/** Le libellé Produit se nettoie : espaces et tirets de fin (« Double Easy - »). */
export function nettoyerLibelle(s: string | null | undefined): string {
  return String(s ?? "")
    .replace(/\s+/g, " ")
    .replace(/[\s\-–—]+$/g, "")
    .trim();
}

export function normaliserLibelle(s: string | null | undefined): string {
  return nettoyerLibelle(s)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

export function nombre(v: string | number | null | undefined): number {
  if (v === null || v === undefined || v === "") return 0;
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const t = String(v).replace(/[\s  ]/g, "").replace(/DH|MAD/gi, "").replace(",", ".");
  const n = Number(t);
  return Number.isFinite(n) ? n : 0;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** Date depuis une cellule Excel (Date, numéro de série, « 24/10/2026 », « 2026-10-24 », avec ou sans heure). */
export function lireDate(v: string | Date | number | null | undefined): ISODate | null {
  if (v === null || v === undefined || v === "") return null;
  if (v instanceof Date) {
    if (Number.isNaN(v.getTime())) return null;
    return `${v.getUTCFullYear()}-${pad(v.getUTCMonth() + 1)}-${pad(v.getUTCDate())}`;
  }
  if (typeof v === "number") {
    // Numéro de série Excel (jours depuis 1899-12-30).
    const ms = Math.round((v - 25569) * 86400 * 1000);
    const d = new Date(ms);
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  }
  const s = String(v).trim();
  let m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/);
  if (m) return `${m[3]}-${pad(Number(m[2]))}-${pad(Number(m[1]))}`;
  m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${pad(Number(m[2]))}-${pad(Number(m[3]))}`;
  return null;
}

export function lireHeure(v: string | Date | number | null | undefined): string | null {
  if (v === null || v === undefined || v === "") return null;
  if (v instanceof Date) return `${pad(v.getUTCHours())}:${pad(v.getUTCMinutes())}`;
  if (typeof v === "number") {
    const minutes = Math.round((v % 1) * 24 * 60);
    return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
  }
  const m = String(v).match(/(\d{1,2}):(\d{2})/);
  return m ? `${pad(Number(m[1]))}:${m[2]}` : null;
}

/** Le total importé doit égaler la feuille SYNTHESE : seule l'erreur d'arrondi au centime est tolérée. */
const TOLERANCE_TOTAL = 0.01;

/**
 * Analyse du rapport détaillé. Règles vérifiées sur le rapport du 24 au 30 octobre 2026 :
 * 1. Prix de vente est le total de la ligne ; le CA du jour est la somme de cette colonne.
 * 2. Un menu génère une ligne « Menu ... » portant le prix et une ligne par composant à prix 0 ;
 *    les unités se comptent sur les lignes du produit lui-même. Les lignes « Menu » ne sont pas des produits.
 * 3. Le libellé se nettoie (espaces et tirets de fin).
 * 4. Les options sans matière (« Sans tomate ») sont ignorées ; les suppléments sont comptés.
 * 5. Le total importé doit égaler la feuille SYNTHESE, sinon l'import est refusé.
 */
export function analyserRapportDetaille(
  brutes: LigneBrute[],
  totalSynthese: number | null,
  correspondance: Map<string, number>,
  libellesRetires: string[] = [],
): AnalyseRapport {
  const retires = new Set(libellesRetires.map(normaliserLibelle));
  const lignes: LigneAnalysee[] = [];
  const parJour = new Map<ISODate, number>();
  const inconnus = new Map<string, { quantite: number; montant: number }>();
  let total = 0;
  let nbIgnorees = 0;
  for (const b of brutes) {
    const date = lireDate(b.date);
    const libelle = nettoyerLibelle(b.produit);
    if (!date || !libelle) {
      nbIgnorees++;
      continue;
    }
    const norm = normaliserLibelle(libelle);
    const quantite = nombre(b.quantite);
    const montant = nombre(b.prix);
    let statut: StatutLigne;
    let produitId: number | null = null;
    if (/^menu\b/.test(norm)) statut = "menu";
    else if (/^sans\b/.test(norm)) statut = "option";
    else if (retires.has(norm)) statut = "retire";
    else {
      const id = correspondance.get(norm);
      if (id !== undefined) {
        statut = "produit";
        produitId = id;
      } else {
        statut = "inconnu";
        const i = inconnus.get(libelle) ?? { quantite: 0, montant: 0 };
        i.quantite += quantite;
        i.montant += montant;
        inconnus.set(libelle, i);
      }
    }
    total += montant;
    parJour.set(date, (parJour.get(date) ?? 0) + montant);
    lignes.push({
      date,
      heure: lireHeure(b.heure),
      ticket: b.ticket === null || b.ticket === undefined ? null : String(b.ticket),
      categorie: b.categorie ? String(b.categorie).trim() : null,
      libelle,
      libelleNorm: norm,
      produitId,
      quantite,
      montant,
      typeVente: b.typeVente ? String(b.typeVente).trim() : null,
      statut,
    });
  }
  total = Math.round(total * 100) / 100;
  let ok = lignes.length > 0;
  let erreur: string | null = ok ? null : "Aucune ligne de vente lisible.";
  if (ok && totalSynthese !== null && Math.abs(total - totalSynthese) > TOLERANCE_TOTAL) {
    ok = false;
    erreur = `Le total des lignes (${total.toFixed(2)} DH) ne correspond pas à la feuille SYNTHESE (${totalSynthese.toFixed(2)} DH). Import refusé.`;
  }
  return { ok, erreur, lignes, parJour, total, totalSynthese, inconnus, nbIgnorees };
}

export interface LigneProduitPeriode {
  libelle: string;
  detail: string | null;
  quantite: number;
  tickets: number;
  montant: number;
  produitId: number | null;
  statut: StatutLigne;
}

/** Format 2 : ventes par produit, CSV point-virgule. Sans heure ni détail par jour. */
export function analyserVentesParProduit(texte: string, correspondance: Map<string, number>, libellesRetires: string[] = []): LigneProduitPeriode[] {
  const retires = new Set(libellesRetires.map(normaliserLibelle));
  const lignes = texte.split(/\r?\n/).filter((l) => l.trim() !== "");
  if (lignes.length === 0) return [];
  const entete = lignes[0].split(";").map((h) => normaliserLibelle(h));
  const idx = (nom: string) => entete.findIndex((h) => h.startsWith(nom));
  const iProduit = idx("produit");
  const iDetail = idx("detail");
  const iQuantite = idx("quantite");
  const iTickets = idx("tickets");
  const iMontant = idx("montant");
  const res: LigneProduitPeriode[] = [];
  for (const l of lignes.slice(1)) {
    const cols = l.split(";");
    const libelle = nettoyerLibelle(cols[iProduit] ?? "");
    if (!libelle) continue;
    const norm = normaliserLibelle(libelle);
    let statut: StatutLigne = "produit";
    let produitId: number | null = null;
    if (/^menu\b/.test(norm)) statut = "menu";
    else if (/^sans\b/.test(norm)) statut = "option";
    else if (retires.has(norm)) statut = "retire";
    else {
      const id = correspondance.get(norm);
      if (id === undefined) statut = "inconnu";
      else produitId = id;
    }
    res.push({
      libelle,
      detail: iDetail >= 0 ? (cols[iDetail] ?? "").trim() || null : null,
      quantite: nombre(cols[iQuantite]),
      tickets: nombre(cols[iTickets]),
      montant: nombre(cols[iMontant]),
      produitId,
      statut,
    });
  }
  return res;
}

/** Table de correspondance libellé normalisé → produit du moteur, depuis les produits et leurs libellés de caisse. */
export function construireCorrespondance(produits: { id: number; nom: string; libellesCaisse: string[] }[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const p of produits) {
    m.set(normaliserLibelle(p.nom), p.id);
    for (const l of p.libellesCaisse) m.set(normaliserLibelle(l), p.id);
  }
  return m;
}
