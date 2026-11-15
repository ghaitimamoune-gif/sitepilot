import { describe, expect, it } from "vitest";
import { Calendrier } from "@/lib/engine/calendrier";
import { Moteur } from "@/lib/engine/moteur";
import type { JourPrevu } from "@/lib/engine/types";
import {
  joursCouverts,
  livraisonSuivante,
  prochaineLivraison,
  proposerQuantite,
  proposerQuantiteFixe,
} from "@/lib/engine/commandes";
import { construireDonneesMoteur } from "@/lib/donnees-initiales/construire";

const cal = new Calendrier();
const donnees = construireDonneesMoteur({ joursSecuriteForce: 1 });
const prevision = (date: string): JourPrevu => ({ date, type: cal.typeJournee(date), ca: 18000 });
const moteur = new Moteur(donnees, cal, prevision);

// Le boucher livre du lundi au samedi, jamais le dimanche.
const boucher = { joursLivraison: [1, 2, 3, 4, 5, 6], delaiJours: 1, heureLimite: "17:00" };
const viande = donnees.idArticle("Viande hachée fraîche (80/20)");

describe("dates de livraison", () => {
  it("une commande du vendredi est livrée le samedi, la suivante le mardi", () => {
    expect(prochaineLivraison(boucher, cal, "2026-11-06")).toBe("2026-11-07");
    expect(livraisonSuivante(boucher, cal, "2026-11-07")).toBe("2026-11-10");
  });

  it("ne propose jamais une livraison de viande un dimanche", () => {
    expect(prochaineLivraison(boucher, cal, "2026-11-07")).toBe("2026-11-10");
    for (let i = 0; i < 14; i++) {
      const d = prochaineLivraison(boucher, cal, `2026-11-${String(i + 1).padStart(2, "0")}`);
      expect(d && new Date(d).getUTCDay()).not.toBe(0);
    }
  });

  it("décale d'un jour après l'heure limite", () => {
    expect(prochaineLivraison(boucher, cal, "2026-11-04", true)).toBe("2026-11-06");
  });

  it("un fournisseur sans jours renseignés livre tout jour ouvert", () => {
    expect(prochaineLivraison({ joursLivraison: [], delaiJours: 1 }, cal, "2026-11-08")).toBe("2026-11-10");
  });
});

describe("jours couverts", () => {
  it("la viande commandée le vendredi couvre le samedi et le dimanche, sans sécurité au-delà", () => {
    const { jours, joursSecurite } = joursCouverts({ dlcJours: 2, joursSecurite: 1 }, cal, "2026-11-07", "2026-11-10");
    expect(jours).toEqual(["2026-11-07", "2026-11-08"]);
    expect(joursSecurite).toEqual([]);
  });

  it("en semaine, la viande livrée jeudi couvre jeudi plus un jour de sécurité", () => {
    const { jours, joursSecurite } = joursCouverts({ dlcJours: 2, joursSecurite: 1 }, cal, "2026-11-05", "2026-11-06");
    expect(jours).toEqual(["2026-11-05"]);
    expect(joursSecurite).toEqual(["2026-11-06"]);
  });

  it("la couverture ne dépasse jamais la DLC", () => {
    const { jours, joursSecurite } = joursCouverts({ dlcJours: 2, joursSecurite: 6 }, cal, "2026-11-03", "2026-11-17");
    expect([...jours, ...joursSecurite]).toEqual(["2026-11-03", "2026-11-04"]);
  });

  it("un produit longue conservation couvre jusqu'à la prochaine livraison plus la sécurité", () => {
    const { jours, joursSecurite } = joursCouverts({ dlcJours: 120, joursSecurite: 6 }, cal, "2026-11-04", "2026-11-11");
    expect(jours).toEqual(["2026-11-04", "2026-11-05", "2026-11-06", "2026-11-07", "2026-11-08", "2026-11-10"]);
    expect(joursSecurite).toHaveLength(6);
  });
});

describe("quantité proposée", () => {
  it("le vendredi, la viande couvre samedi et dimanche", () => {
    const p = proposerQuantite({
      moteur,
      articleId: viande,
      fournisseur: boucher,
      dateCommande: "2026-11-06",
      stockActuel: 0,
      enCommande: 0,
      qteParUniteCommande: 1,
    })!;
    expect(p.dateLivraison).toBe("2026-11-07");
    expect(p.jours).toEqual(["2026-11-07", "2026-11-08"]);
    expect(p.joursSecurite).toEqual([]);
    const attendu = moteur.besoinAchat(viande, "2026-11-07") + moteur.besoinAchat(viande, "2026-11-08");
    expect(p.besoin).toBeCloseTo(attendu, 6);
    // Stock 0, consommation du vendredi à venir : disponible négatif, on commande besoin + consommation.
    expect(p.consommationAvantLivraison).toBeCloseTo(moteur.besoinAchat(viande, "2026-11-06"), 6);
    expect(p.aCommanderComptage).toBeCloseTo(attendu + p.consommationAvantLivraison, 6);
  });

  it("déduit le stock et les quantités déjà commandées, arrondit au conditionnement", () => {
    const p = proposerQuantite({
      moteur,
      articleId: viande,
      fournisseur: boucher,
      dateCommande: "2026-11-06",
      stockActuel: 30,
      enCommande: 5,
      qteParUniteCommande: 5,
    })!;
    const disponible = 30 - p.consommationAvantLivraison + 5;
    expect(p.disponible).toBeCloseTo(disponible, 6);
    expect(p.aCommanderComptage).toBeCloseTo(Math.max(0, p.besoin - disponible), 6);
    expect(p.aCommanderUnites).toBe(Math.ceil(p.aCommanderComptage / 5));
  });

  it("ne commande rien si le stock couvre le besoin", () => {
    const p = proposerQuantite({
      moteur,
      articleId: viande,
      fournisseur: boucher,
      dateCommande: "2026-11-06",
      stockActuel: 1000,
      enCommande: 0,
      qteParUniteCommande: 1,
    })!;
    expect(p.aCommanderComptage).toBe(0);
    expect(p.aCommanderUnites).toBe(0);
  });
});

describe("articles sans lien avec les ventes", () => {
  it("passe à commander sous le minimum, jusqu'au stock cible", () => {
    const r = proposerQuantiteFixe({ stockActuel: 1, enCommande: 0, stockMinimum: 2, stockCible: 6, qteParUniteCommande: 1 });
    expect(r.sousMinimum).toBe(true);
    expect(r.aCommanderComptage).toBe(5);
    const ok = proposerQuantiteFixe({ stockActuel: 3, enCommande: 0, stockMinimum: 2, stockCible: 6, qteParUniteCommande: 1 });
    expect(ok.sousMinimum).toBe(false);
    expect(ok.aCommanderUnites).toBe(0);
  });
});
