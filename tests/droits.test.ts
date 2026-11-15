import { describe, expect, it } from "vitest";
import { aLeDroit, dansPerimetre, roleRemontee, longueurPin, type PosteMinimal } from "@/lib/auth/droits";

const owner: PosteMinimal = { id: 1, role: "proprietaire", zone: "direction", posteSuperieurId: null };
const manager: PosteMinimal = { id: 2, role: "manager", zone: "direction", posteSuperieurId: null };
const achats: PosteMinimal = { id: 3, role: "resp_achats", zone: "direction", posteSuperieurId: 2 };
const cuisine: PosteMinimal = { id: 4, role: "resp_cuisine", zone: "cuisine", posteSuperieurId: 2 };
const salle: PosteMinimal = { id: 5, role: "resp_salle", zone: "salle", posteSuperieurId: 2 };
const grill: PosteMinimal = { id: 6, role: "employe", zone: "cuisine", posteSuperieurId: 4 };
const serveur: PosteMinimal = { id: 7, role: "employe", zone: "salle", posteSuperieurId: 5 };

describe("matrice des droits", () => {
  it("la responsable achats ne réceptionne jamais", () => {
    expect(aLeDroit("resp_achats", "receptions:ecrire")).toBe(false);
    expect(aLeDroit("resp_achats", "receptions:lire")).toBe(false);
    expect(aLeDroit("manager", "receptions:ecrire")).toBe(true);
    expect(aLeDroit("resp_cuisine", "receptions:ecrire")).toBe(true);
  });

  it("le responsable cuisine ne force pas les quantités, la manager oui", () => {
    expect(aLeDroit("resp_cuisine", "preparations:forcer")).toBe(false);
    expect(aLeDroit("resp_cuisine", "preparations:restes")).toBe(true);
    expect(aLeDroit("manager", "preparations:forcer")).toBe(true);
  });

  it("la manager ne décide pas les commandes, la responsable achats ne les valide pas", () => {
    expect(aLeDroit("manager", "commandes:ecrire")).toBe(false);
    expect(aLeDroit("resp_achats", "commandes:ecrire")).toBe(true);
    expect(aLeDroit("resp_achats", "commandes:valider")).toBe(false);
    expect(aLeDroit("proprietaire", "commandes:valider")).toBe(true);
  });

  it("seuls les propriétaires écrivent le prévisionnel et les paramètres", () => {
    expect(aLeDroit("proprietaire", "previsionnel:ecrire")).toBe(true);
    expect(aLeDroit("manager", "previsionnel:ecrire")).toBe(false);
    expect(aLeDroit("manager", "previsionnel:lire")).toBe(true);
    expect(aLeDroit("manager", "parametres:ecrire")).toBe(false);
  });

  it("tout le monde coche ses tâches", () => {
    for (const r of ["proprietaire", "manager", "resp_achats", "resp_cuisine", "resp_salle", "employe"] as const) {
      expect(aLeDroit(r, "taches:cocher")).toBe(true);
    }
  });
});

describe("périmètre des tâches", () => {
  it("un propriétaire crée pour tout poste", () => {
    expect(dansPerimetre(owner, manager)).toBe(true);
    expect(dansPerimetre(owner, grill)).toBe(true);
  });
  it("la manager crée pour tout poste sous elle", () => {
    expect(dansPerimetre(manager, cuisine)).toBe(true);
    expect(dansPerimetre(manager, serveur)).toBe(true);
    expect(dansPerimetre(manager, owner)).toBe(false);
  });
  it("le responsable cuisine ne touche que les postes de cuisine", () => {
    expect(dansPerimetre(cuisine, grill)).toBe(true);
    expect(dansPerimetre(cuisine, serveur)).toBe(false);
    expect(dansPerimetre(salle, serveur)).toBe(true);
    expect(dansPerimetre(salle, grill)).toBe(false);
    expect(dansPerimetre(achats, grill)).toBe(false);
  });
});

describe("remontée par strates", () => {
  it("suit la hiérarchie du brief", () => {
    expect(roleRemontee(grill)).toBe("resp_cuisine");
    expect(roleRemontee(serveur)).toBe("resp_salle");
    expect(roleRemontee(cuisine)).toBe("manager");
    expect(roleRemontee(achats)).toBe("manager");
    expect(roleRemontee(manager)).toBe("proprietaire");
    expect(roleRemontee(owner)).toBeNull();
  });
});

describe("PIN", () => {
  it("6 chiffres pour les propriétaires, 4 pour les postes", () => {
    expect(longueurPin("proprietaire")).toBe(6);
    expect(longueurPin("employe")).toBe(4);
  });
});
