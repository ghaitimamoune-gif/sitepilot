/** Formats français : espace fine pour les milliers, virgule décimale, montants en DH. */

const nf = (min: number, max: number) =>
  new Intl.NumberFormat("fr-FR", { minimumFractionDigits: min, maximumFractionDigits: max });

const cache = new Map<string, Intl.NumberFormat>();
function formatter(min: number, max: number): Intl.NumberFormat {
  const k = `${min}-${max}`;
  let f = cache.get(k);
  if (!f) {
    f = nf(min, max);
    cache.set(k, f);
  }
  return f;
}

export function fmtNombre(n: number | string | null | undefined, decimales = 1): string {
  if (n === null || n === undefined || n === "") return "—";
  const v = typeof n === "string" ? Number(n) : n;
  if (!Number.isFinite(v)) return "—";
  const texte = formatter(0, decimales).format(v).replace(/ /g, " ");
  return /^-0([,.]0*)?$/.test(texte) ? texte.slice(1) : texte;
}

export function fmtEntier(n: number | string | null | undefined): string {
  return fmtNombre(n, 0);
}

export function fmtDH(n: number | string | null | undefined, decimales = 0): string {
  if (n === null || n === undefined || n === "") return "—";
  const v = typeof n === "string" ? Number(n) : n;
  if (!Number.isFinite(v)) return "—";
  return `${formatter(decimales, decimales).format(v).replace(/ /g, " ")} DH`;
}

export function fmtPct(n: number | string | null | undefined, decimales = 1): string {
  if (n === null || n === undefined || n === "") return "—";
  const v = typeof n === "string" ? Number(n) : n;
  if (!Number.isFinite(v)) return "—";
  return `${formatter(0, decimales).format(v * 100)} %`;
}

/** Quantité affichée : pièces à l'entier supérieur, poids et volumes à une décimale vers le haut. */
export function fmtQuantite(n: number | string | null | undefined, estPiece: boolean): string {
  if (n === null || n === undefined || n === "") return "—";
  const v = typeof n === "string" ? Number(n) : n;
  if (!Number.isFinite(v)) return "—";
  const eps = 1e-9;
  const brut = estPiece ? Math.ceil(v - eps) : Math.ceil(v * 10 - eps) / 10;
  const arrondi = brut === 0 ? 0 : brut; // jamais « -0 »
  return estPiece ? fmtEntier(arrondi) : fmtNombre(arrondi, 1);
}

/** Accepte « 1,5 », « 1.5 », « 1 250 ». Renvoie null si vide ou invalide. */
export function parseNombre(s: string | number | null | undefined): number | null {
  if (s === null || s === undefined) return null;
  if (typeof s === "number") return Number.isFinite(s) ? s : null;
  const t = s.replace(/[\s  ]/g, "").replace(",", ".");
  if (t === "" || t === "-" || t === ".") return null;
  const v = Number(t);
  return Number.isFinite(v) ? v : null;
}

export function num(v: string | number | null | undefined, defaut = 0): number {
  if (v === null || v === undefined) return defaut;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : defaut;
}

export function pluriel(n: number, singulier: string, plurielForme?: string): string {
  return n > 1 ? (plurielForme ?? `${singulier}s`) : singulier;
}
