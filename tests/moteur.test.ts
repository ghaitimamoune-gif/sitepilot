/**
 * Recette du moteur contre les jeux d'essai A et B de la section 16 du brief,
 * à 0,5 % près, valeurs non arrondies.
 */
import { describe, expect, it } from "vitest";
import { Calendrier } from "@/lib/engine/calendrier";
import { Moteur, arrondiAffichage } from "@/lib/engine/moteur";
import type { JourPrevu } from "@/lib/engine/types";
import { construireDonneesMoteur } from "@/lib/donnees-initiales/construire";

const TOLERANCE = 0.005;

function proche(valeur: number, attendu: number) {
  if (attendu === 0) {
    expect(Math.abs(valeur)).toBeLessThan(1e-6);
    return;
  }
  const ecart = Math.abs(valeur - attendu) / Math.abs(attendu);
  expect(ecart, `attendu ${attendu}, obtenu ${valeur}`).toBeLessThanOrEqual(TOLERANCE);
}

// Paramètres des jeux d'essai : marge de 10 %, un jour de sécurité pour tous les articles.
const donnees = construireDonneesMoteur({ joursSecuriteForce: 1 });
const calendrier = new Calendrier();

function moteurA() {
  // Jeu A : mercredi 4 novembre 2026, 18 000 DH, prochain jour jeudi 18 000 DH, CA constant.
  const prevision = (date: string): JourPrevu => ({ date, type: "semaine", ca: 18000 });
  return new Moteur(donnees, calendrier, prevision);
}

function moteurB() {
  // Jeu B : dimanche 8 novembre 2026 (week-end, 28 175 DH), prochain jour mardi (semaine, 18 275 DH).
  const prevision = (date: string): JourPrevu =>
    date === "2026-11-08" ? { date, type: "weekend", ca: 28175 } : { date, type: "semaine", ca: 18275 };
  return new Moteur(donnees, calendrier, prevision);
}

const A = "2026-11-04";
const B = "2026-11-08";

describe("calendrier", () => {
  it("ferme le lundi et connaît la veille de fermeture", () => {
    expect(calendrier.estOuvert("2026-11-09")).toBe(false); // lundi
    expect(calendrier.estOuvert("2026-11-08")).toBe(true); // dimanche
    expect(calendrier.prochainJourOuvert("2026-11-08")).toBe("2026-11-10"); // mardi
    expect(calendrier.estVeilleFermeture("2026-11-08")).toBe(true);
    expect(calendrier.estVeilleFermeture("2026-11-04")).toBe(false);
    expect(calendrier.typeJournee("2026-11-07")).toBe("weekend");
    expect(calendrier.typeJournee("2026-11-04")).toBe("semaine");
  });

  it("applique les jours fériés et fermetures exceptionnelles", () => {
    const cal = new Calendrier({
      joursFermetureHebdo: [1],
      joursWeekend: [6, 0],
      exceptions: new Map([
        ["2026-11-06", { ouvert: true, type: "weekend", note: "Fête de l'Indépendance" }],
        ["2026-11-10", { ouvert: false, type: "semaine", note: "Fermeture exceptionnelle" }],
      ]),
    });
    expect(cal.typeJournee("2026-11-06")).toBe("weekend");
    expect(cal.estOuvert("2026-11-10")).toBe(false);
    expect(cal.prochainJourOuvert("2026-11-08")).toBe("2026-11-11");
    expect(cal.joursOuverts("2026-11-08", 3)).toEqual(["2026-11-08", "2026-11-11", "2026-11-12"]);
  });
});

describe("jeu A — ventes prévues", () => {
  const m = moteurA();
  it("calcule les unités vendues", () => {
    proche(m.unitesVendues(donnees.idProduit("Easy"), A), 55.404);
    proche(m.unitesVendues(donnees.idProduit("Double Easy"), A), 83.952);
    proche(m.unitesVendues(donnees.idProduit("Classic Double Cheese"), A), 18.468);
    proche(m.unitesVendues(donnees.idProduit("4x4"), A), 3.834);
    proche(m.unitesVendues(donnees.idProduit("Hamburger Enfants"), A), 1.926);
    proche(m.unitesVendues(donnees.idProduit("Frites"), A), 83.466);
  });

  it("contrôle à la main des boulettes", () => {
    const id = donnees.idArticle("Boulettes smash pressées");
    proche(m.besoinNet(id, A), 279.18);
    proche(m.besoinBrutDirect(id, A), 319.894);
  });
});

const ATTENDU_PREPARATIONS: Record<string, { A: [number, number, number, number | null]; B: [number, number, number, number | null] }> = {
  // [aujourd'hui, avance, total, batchs]
  "Boulettes smash pressées": { A: [319.894, 95.968, 415.862, null], B: [505.145, 0, 505.145, null] },
  "Pains burger": { A: [191.428, 0, 191.428, null], B: [295.781, 0, 295.781, null] },
  "Salade iceberg taillée": { A: [1.413, 0.353, 1.766, null], B: [2.129, 0, 2.129, null] },
  "Tomates en rondelles": { A: [5.298, 1.325, 6.623, null], B: [7.985, 0, 7.985, null] },
  "Oignons rouges en rondelles": { A: [1.766, 0.706, 2.472, null], B: [2.662, 0, 2.662, null] },
  "Frites taillées et trempées": { A: [34.63, 8.657, 43.287, null], B: [49.999, 0, 49.999, null] },
  "Sauce Easy": { A: [9.879, 4.939, 14.818, 6], B: [14.323, 5.015, 19.338, 7] },
  "Sweet creamy, sauce finie": { A: [0.3, 0.15, 0.45, 1], B: [0.812, 0.152, 0.964, 1] },
  "Mayo truffe": { A: [0.667, 0.333, 1.0, null], B: [1.106, 0.338, 1.444, null] },
  "Boules de pâte à cookies": { A: [14.715, 7.357, 22.072, 1], B: [21.89, 7.47, 29.36, 2] },
  "Concentré de citronnade": { A: [10.888, 5.444, 16.332, 7], B: [15.842, 5.527, 21.369, 9] },
  "Sirop de sucre": { A: [6.533, 3.266, 9.799, 3], B: [9.505, 3.316, 12.822, 4] },
};

describe("préparations du jour", () => {
  for (const [nom, attendu] of Object.entries(ATTENDU_PREPARATIONS)) {
    it(`jeu A — ${nom}`, () => {
      const f = moteurA().preparationDuJour(donnees.idArticle(nom), A);
      proche(f.aujourdHui, attendu.A[0]);
      proche(f.avance, attendu.A[1]);
      proche(f.total, attendu.A[2]);
      if (attendu.A[3] !== null) expect(f.batchs).toBe(attendu.A[3]);
    });
    it(`jeu B — ${nom}`, () => {
      const f = moteurB().preparationDuJour(donnees.idArticle(nom), B);
      proche(f.aujourdHui, attendu.B[0]);
      proche(f.avance, attendu.B[1]);
      proche(f.total, attendu.B[2]);
      if (attendu.B[3] !== null) expect(f.batchs).toBe(attendu.B[3]);
    });
  }

  it("jeu B — l'avance est nulle la veille de fermeture pour les produits courts", () => {
    const m = moteurB();
    const f = m.preparationDuJour(donnees.idArticle("Boulettes smash pressées"), B);
    expect(f.avanceSupprimee).toBe(true);
    const sauce = m.preparationDuJour(donnees.idArticle("Sauce Easy"), B);
    expect(sauce.avanceSupprimee).toBe(false);
  });

  it("déduit le reste de la veille et applique un forçage", () => {
    const m = moteurA();
    const id = donnees.idArticle("Sauce Easy");
    const f = m.preparationDuJour(id, A, 4);
    proche(f.aPreparer, 14.818 - 4);
    expect(f.batchs).toBe(4);
    const force = m.preparationDuJour(id, A, 4, 20);
    expect(force.aPreparer).toBe(20);
    proche(force.aPreparerCalcule, 10.818);
    expect(force.batchs).toBe(8);
  });

  it("la fiche ne liste que les préparations avec part d'avance", () => {
    const fiche = moteurA().fichePreparations(A);
    const noms = fiche.map((f) => f.nom);
    expect(noms).toContain("Sauce Easy");
    expect(noms).not.toContain("Citronnade servie");
    expect(noms).not.toContain("Base sweet creamy");
  });
});

const ATTENDU_STOCK: Record<string, { A: [number, number, number]; B: [number, number, number] }> = {
  // [besoin du jour, couverture, stock cible]
  "Viande hachée fraîche (80/20)": { A: [22.97, 2, 45.94], B: [36.358, 1, 36.358] },
  "Pains burger": { A: [191.428, 1, 191.428], B: [295.781, 1, 295.781] },
  "Salade iceberg": { A: [1.884, 3, 5.651], B: [2.839, 3, 6.664] },
  Tomates: { A: [5.759, 3, 17.276], B: [8.68, 3, 20.373] },
  "Pommes de terre": { A: [46.173, 4, 184.691], B: [66.665, 4, 207.3] },
  "Cheddar en tranches": { A: [316.882, 8, 2535.053], B: [505.018, 8, 2757.078] },
};

describe("stock cible", () => {
  for (const [nom, attendu] of Object.entries(ATTENDU_STOCK)) {
    const id = donnees.idArticle(nom);
    const intervalle = donnees.livraisonTousLes.get(id) ?? 0;
    it(`jeu A — ${nom}`, () => {
      const s = moteurA().stockCible(id, A, intervalle);
      proche(s.besoinJour, attendu.A[0]);
      expect(s.couverture).toBe(attendu.A[1]);
      proche(s.cible, attendu.A[2]);
    });
    it(`jeu B — ${nom}`, () => {
      const s = moteurB().stockCible(id, B, intervalle);
      proche(s.besoinJour, attendu.B[0]);
      expect(s.couverture).toBe(attendu.B[1]);
      proche(s.cible, attendu.B[2]);
    });
  }

  it("somme les vrais jours quand le prévisionnel varie", () => {
    const prevision = (date: string): JourPrevu =>
      date === "2026-11-05" ? { date, type: "semaine", ca: 36000 } : { date, type: "semaine", ca: 18000 };
    const m = new Moteur(donnees, calendrier, prevision);
    const s = m.stockCible(donnees.idArticle("Viande hachée fraîche (80/20)"), A, 1);
    proche(s.cible, 22.97 + 2 * 22.97);
  });
});

describe("ingrédients d'une préparation", () => {
  it("répartit un besoin au prorata du batch", () => {
    const m = moteurA();
    const ing = m.ingredients(donnees.idArticle("Sauce Easy"), 14.818);
    const mayo = ing.find((i) => i.nom === "Mayonnaise")!;
    proche(mayo.quantite, (14.818 / 2.801) * 1.495);
  });
});

describe("arrondis d'affichage", () => {
  it("pièces à l'entier supérieur, poids à une décimale vers le haut", () => {
    expect(arrondiAffichage(319.894, true)).toBe(320);
    expect(arrondiAffichage(1.413, false)).toBe(1.5);
    expect(arrondiAffichage(9.879, false)).toBe(9.9);
    expect(arrondiAffichage(2.0, false)).toBe(2.0);
    expect(arrondiAffichage(5, true)).toBe(5);
  });
});
