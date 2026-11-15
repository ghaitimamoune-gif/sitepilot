import { describe, expect, it } from "vitest";
import { normaliserPrenom, presenterPrenom, prenomValide } from "@/lib/auth/prenom";

describe("prénoms", () => {
  it("« youssef » et « Youssef » sont la même personne", () => {
    expect(normaliserPrenom("Youssef")).toBe(normaliserPrenom("youssef"));
    expect(normaliserPrenom(" YOUSSEF ")).toBe("youssef");
  });
  it("ignore les accents et les espaces", () => {
    expect(normaliserPrenom("Mohamed-Amine")).toBe("mohamedamine");
    expect(normaliserPrenom("Aïcha")).toBe("aicha");
    expect(normaliserPrenom("Jean Pierre")).toBe("jeanpierre");
  });
  it("présente le prénom proprement", () => {
    expect(presenterPrenom("youssef")).toBe("Youssef");
    expect(presenterPrenom("  mohamed   amine ")).toBe("Mohamed Amine");
  });
  it("refuse les prénoms vides ou trop longs", () => {
    expect(prenomValide("")).toBe(false);
    expect(prenomValide("A")).toBe(false);
    expect(prenomValide("Youssef")).toBe(true);
    expect(prenomValide("x".repeat(40))).toBe(false);
  });
});
