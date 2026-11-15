import ExcelJS from "exceljs";
import { normaliserLibelle, nombre, type LigneBrute } from "./caisse";

export interface ClasseurLu {
  lignes: LigneBrute[];
  totalSynthese: number | null;
  feuille: string | null;
}

function texteCellule(v: ExcelJS.CellValue): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "object") {
    if (v instanceof Date) return v.toISOString();
    if ("richText" in v) return v.richText.map((r) => r.text).join("");
    if ("text" in v) return String(v.text);
    if ("result" in v) return String(v.result ?? "");
    if ("hyperlink" in v) return String((v as { text?: string }).text ?? "");
  }
  return String(v);
}

function valeurCellule(v: ExcelJS.CellValue): string | number | Date | null {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return v;
  if (typeof v === "number" || typeof v === "string") return v;
  if (typeof v === "object" && "result" in v) {
    const r = v.result;
    if (r instanceof Date || typeof r === "number" || typeof r === "string") return r;
    return null;
  }
  return texteCellule(v);
}

/** Lit le rapport détaillé des ventes : feuille EXPORT DES VENTES et total de la feuille SYNTHESE. */
export async function lireRapportDetaille(contenu: Buffer): Promise<ClasseurLu> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(contenu as unknown as ArrayBuffer);
  const feuilleVentes =
    wb.worksheets.find((w) => normaliserLibelle(w.name).includes("export")) ??
    wb.worksheets.find((w) => normaliserLibelle(w.name).includes("vente")) ??
    wb.worksheets[0];
  const lignes: LigneBrute[] = [];
  let feuille: string | null = null;
  if (feuilleVentes) {
    feuille = feuilleVentes.name;
    // Ligne d'en-tête : celle qui contient « Produit » et « Quantité ».
    let enteteIdx = -1;
    const colonnes: Record<string, number> = {};
    feuilleVentes.eachRow((row, n) => {
      if (enteteIdx >= 0) return;
      const cellules: string[] = [];
      row.eachCell({ includeEmpty: true }, (c, i) => {
        cellules[i] = normaliserLibelle(texteCellule(c.value));
      });
      if (cellules.some((c) => c === "produit") && cellules.some((c) => c && c.startsWith("quantit"))) {
        enteteIdx = n;
        cellules.forEach((c, i) => {
          if (!c) return;
          if (c === "date") colonnes.date = i;
          else if (c === "heure") colonnes.heure = i;
          else if (c.includes("ticket")) colonnes.ticket = i;
          else if (c.startsWith("categ")) colonnes.categorie = i;
          else if (c === "produit") colonnes.produit = i;
          else if (c.startsWith("quantit")) colonnes.quantite = i;
          else if (c.includes("prix")) colonnes.prix = i;
          else if (c.includes("type")) colonnes.typeVente = i;
        });
      }
    });
    if (enteteIdx >= 0) {
      feuilleVentes.eachRow((row, n) => {
        if (n <= enteteIdx) return;
        const v = (k: string) => (colonnes[k] ? valeurCellule(row.getCell(colonnes[k]).value) : null);
        lignes.push({
          date: v("date") as LigneBrute["date"],
          heure: v("heure") as LigneBrute["heure"],
          ticket: v("ticket") as LigneBrute["ticket"],
          categorie: v("categorie") === null ? null : String(v("categorie")),
          produit: v("produit") === null ? null : String(v("produit")),
          quantite: v("quantite") as LigneBrute["quantite"],
          prix: v("prix") as LigneBrute["prix"],
          typeVente: v("typeVente") === null ? null : String(v("typeVente")),
        });
      });
    }
  }
  // Feuille SYNTHESE : la valeur numérique associée à une étiquette « total », « TTC » ou « chiffre d'affaires ».
  let totalSynthese: number | null = null;
  const synthese = wb.worksheets.find((w) => normaliserLibelle(w.name).includes("synth"));
  if (synthese) {
    let meilleur: number | null = null;
    let fallback: number | null = null;
    synthese.eachRow((row) => {
      const vals: (string | number | Date | null)[] = [];
      row.eachCell({ includeEmpty: true }, (c, i) => {
        vals[i] = valeurCellule(c.value);
      });
      const etiquette = vals.map((x) => (typeof x === "string" ? normaliserLibelle(x) : "")).join(" ");
      const nombres = vals.filter((x): x is number | string => typeof x === "number" || (typeof x === "string" && /^[\d\s.,]+$/.test(x))).map((x) => nombre(x)).filter((x) => x > 0);
      if (nombres.length === 0) return;
      const max = Math.max(...nombres);
      if (/ttc|chiffre|total/.test(etiquette)) {
        if (meilleur === null || /ttc/.test(etiquette)) meilleur = max;
      }
      if (fallback === null || max > fallback) fallback = max;
    });
    totalSynthese = meilleur ?? fallback;
  }
  return { lignes, totalSynthese, feuille };
}
