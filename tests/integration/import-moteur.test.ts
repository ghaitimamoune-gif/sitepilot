/**
 * Import du rapport détaillé de lacaisse.ma, prévisionnel sans saisie, et moteur chargé
 * depuis la base comparé au jeu d'essai A du brief.
 */
import ExcelJS from "exceljs";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { db, schema } from "@/lib/db";
import { analyserRapportDetaille, nettoyerLibelle } from "@/lib/import/caisse";
import { importerRapportDetaille } from "@/lib/services/imports";
import { chargerMoteur } from "@/lib/services/moteur";
import { enregistrerPrevision, listerPrevisions } from "@/lib/services/previsions";
import { acteurPour, baseDisponible, idArticle, maintenant, reinitialiserBase, type ActeurTest } from "./base";

const disponible = await baseDisponible();

/** Chiffres de la recette du brief (rapport du 24 au 30 octobre 2026, lundi 26 fermé). */
const JOURS: [string, number][] = [
  ["24/10/2026", 28455],
  ["25/10/2026", 28175],
  ["27/10/2026", 18275],
  ["28/10/2026", 18012],
  ["29/10/2026", 16997],
  ["30/10/2026", 21757],
];

async function rapport(totalSynthese: number): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const s = wb.addWorksheet("SYNTHESE");
  s.addRow(["Période", "24/10/2026 - 30/10/2026"]);
  s.addRow(["Chiffre d'affaires TTC", totalSynthese]);
  const v = wb.addWorksheet("EXPORT DES VENTES");
  v.addRow(["Date", "Heure", "Num ticket", "Categorie", "Produit", "Quantité", "Prix de vente", "Type de vente"]);
  let ticket = 1000;
  for (const [date, total] of JOURS) {
    // Un menu : la ligne « Menu » porte le prix, les composants sont à 0 et comptent les unités.
    v.addRow([date, "13:05", ticket, "Menus", "Menu Easy", 1, 95, "Sur place"]);
    v.addRow([date, "13:05", ticket, "Burgers", "Easy", 1, 0, "Sur place"]);
    v.addRow([date, "13:05", ticket, "Sides", "Frites", 1, 0, "Sur place"]);
    v.addRow([date, "13:05", ticket, "Options", "Sans tomate", 1, 0, "Sur place"]);
    ticket++;
    // Libellé avec tiret et espaces de fin, à nettoyer.
    v.addRow([date, "13:20", ticket, "Burgers", "Double Easy - ", 10, 900, "Sur place"]);
    ticket++;
    // Erreur de saisie en caisse : un libellé retiré de la carte, inconnu du moteur.
    v.addRow([date, "14:02", ticket, "Desserts", "Mini Beignets", 2, 60, "Sur place"]);
    ticket++;
    v.addRow([date, "20:40", ticket, "Burgers", "Easy", 40, total - 95 - 900 - 60, "Sur place"]);
    ticket++;
  }
  return Buffer.from(await wb.xlsx.writeBuffer());
}

describe("règles de lecture du rapport (partie pure)", () => {
  it("nettoie les libellés et classe menus, options, inconnus", () => {
    expect(nettoyerLibelle("Double Easy - ")).toBe("Double Easy");
    const corr = new Map([["easy", 1], ["double easy", 2], ["frites", 3]]);
    const a = analyserRapportDetaille(
      [
        { date: "24/10/2026", heure: "13:00", ticket: 1, categorie: "Menus", produit: "Menu Easy", quantite: 1, prix: 95, typeVente: null },
        { date: "24/10/2026", heure: "13:00", ticket: 1, categorie: "Burgers", produit: "Easy", quantite: 1, prix: 0, typeVente: null },
        { date: "24/10/2026", heure: "13:00", ticket: 1, categorie: "Options", produit: "Sans oignon", quantite: 1, prix: 0, typeVente: null },
        { date: "24/10/2026", heure: "13:00", ticket: 2, categorie: "Desserts", produit: "Mini Beignets", quantite: 1, prix: 30, typeVente: null },
      ],
      125,
      corr,
    );
    expect(a.ok).toBe(true);
    expect(a.lignes.map((l) => l.statut)).toEqual(["menu", "produit", "option", "inconnu"]);
    expect(a.inconnus.get("Mini Beignets")).toEqual({ quantite: 1, montant: 30 });
    const refuse = analyserRapportDetaille([{ date: "24/10/2026", heure: null, ticket: 1, categorie: null, produit: "Easy", quantite: 1, prix: 10, typeVente: null }], 11, corr);
    expect(refuse.ok).toBe(false);
    expect(refuse.erreur).toMatch(/SYNTHESE/);
  });
});

describe.skipIf(!disponible)("import du rapport détaillé de la caisse", () => {
  let owner: ActeurTest;

  beforeAll(async () => {
    await reinitialiserBase();
    owner = await acteurPour("Propriétaire — Jaafar", "Jaafar");
    maintenant("2026-11-02T10:00:00+01:00");
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  it("refuse un fichier dont le total ne correspond pas à la feuille SYNTHESE", async () => {
    await expect(importerRapportDetaille(owner, await rapport(131000), "rapport.xlsx")).rejects.toThrow(/ne correspond pas/);
  });

  it("donne 131 671 DH au total et le CA de chaque journée", async () => {
    const r = await importerRapportDetaille(owner, await rapport(131671), "rapport.xlsx");
    expect(r.total).toBeCloseTo(131671, 2);
    expect(r.jours.map((j) => Math.round(j.total))).toEqual([28455, 28175, 18275, 18012, 16997, 21757]);
    expect(r.jours.map((j) => j.date)).toEqual(["2026-10-24", "2026-10-25", "2026-10-27", "2026-10-28", "2026-10-29", "2026-10-30"]);
    const clotures = await db.select().from(schema.cloturesJournee);
    expect(clotures.find((c) => c.date === "2026-10-24")?.source).toBe("import");
    expect(Number(clotures.find((c) => c.date === "2026-10-27")?.caRealise)).toBe(18275);
    // Libellé inconnu : ligne bloquée et signalée aux propriétaires.
    expect(r.inconnus.map((i) => i.libelle)).toEqual(["Mini Beignets"]);
    const alertes = await db.select().from(schema.alertes).where(eq(schema.alertes.type, "import_libelle_inconnu"));
    expect(alertes[0].roles).toContain("proprietaire");
  });

  it("compte les unités sur les lignes du produit, menus exclus", async () => {
    const [easy] = await db.select().from(schema.produitsVendus).where(eq(schema.produitsVendus.nom, "Easy"));
    const [double] = await db.select().from(schema.produitsVendus).where(eq(schema.produitsVendus.nom, "Double Easy"));
    const ventes = await db.select().from(schema.ventes).where(eq(schema.ventes.date, "2026-10-24"));
    const somme = (id: number) => ventes.filter((v) => v.produitId === id).reduce((s, v) => s + Number(v.quantite), 0);
    expect(somme(easy.id)).toBe(41);
    expect(somme(double.id)).toBe(10);
    expect(ventes.some((v) => v.libelle === "Sans tomate")).toBe(false);
  });

  it("la consommation théorique de la journée vient des ventes réelles", async () => {
    const boulettes = await idArticle("Boulettes smash pressées");
    const mvts = await db.select().from(schema.mouvementsStock).where(eq(schema.mouvementsStock.origineType, "journee:2026-10-24"));
    const conso = mvts.filter((m) => m.articleId === boulettes && m.nature === "consommation").reduce((s, m) => s + Number(m.quantite), 0);
    // 41 Easy (1 boulette) + 10 Double Easy (2 boulettes)
    expect(-conso).toBeCloseTo(61, 6);
    expect(mvts.some((m) => m.note?.includes("ventes importées"))).toBe(true);
  });
});

describe.skipIf(!disponible)("prévisionnel et moteur chargé depuis la base", () => {
  let owner: ActeurTest;

  beforeAll(async () => {
    await reinitialiserBase();
    owner = await acteurPour("Propriétaire — Amani", "Amani");
    maintenant("2026-11-03T09:00:00+01:00");
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  it("sans aucune saisie, les 14 prochains jours sont remplis par l'estimation", async () => {
    const p = await listerPrevisions(14, "2026-11-03");
    expect(p).toHaveLength(12); // deux lundis fermés
    expect(p.every((x) => x.origine === "estime")).toBe(true);
    expect(p.find((x) => x.date === "2026-11-04")?.ca).toBe(18760);
    expect(p.find((x) => x.date === "2026-11-07")?.ca).toBe(28315);
  });

  it("une valeur saisie n'est jamais écrasée par l'estimation", async () => {
    await enregistrerPrevision(owner, "2026-11-04", 18000);
    await enregistrerPrevision(owner, "2026-11-05", 18000);
    const p = await listerPrevisions(14, "2026-11-03");
    expect(p.find((x) => x.date === "2026-11-04")).toMatchObject({ ca: 18000, origine: "saisi" });
  });

  it("les chiffres du moteur chargé depuis la base égalent le jeu d'essai A", async () => {
    const { moteur } = await chargerMoteur();
    const sauce = moteur.preparationDuJour(await idArticle("Sauce Easy"), "2026-11-04");
    expect(sauce.aujourdHui).toBeCloseTo(9.879, 2);
    expect(sauce.total).toBeCloseTo(14.818, 2);
    expect(sauce.batchs).toBe(6);
    const boulettes = moteur.preparationDuJour(await idArticle("Boulettes smash pressées"), "2026-11-04");
    expect(boulettes.aujourdHui / 319.894).toBeCloseTo(1, 3);
    expect(boulettes.avance / 95.968).toBeCloseTo(1, 3);
    const viande = moteur.stockCible(await idArticle("Viande hachée fraîche (80/20)"), "2026-11-04", 1);
    expect(viande.couverture).toBe(2);
    expect(viande.cible / 45.94).toBeCloseTo(1, 3);
  });
});
