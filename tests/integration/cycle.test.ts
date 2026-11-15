/**
 * Test de bout en bout des services contre une vraie base PostgreSQL :
 * comptage → commande → envoi WhatsApp → réception à l'aveugle → stock, puis ruptures,
 * hausses de prix, fournisseur créé sur le terrain, tâches et remontées, clôture de journée.
 *
 * Calendrier : vendredi 6 novembre 2026 (semaine), samedi 7 (week-end), dimanche 8 (veille de fermeture).
 */
import { and, eq, isNull } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { db, schema } from "@/lib/db";
import { calculerMouvements } from "@/lib/services/consommation";
import { cloturerJournee, coutMatiereDuJour } from "@/lib/services/cloture";
import { creerFournisseurTerrain, enregistrerPrix } from "@/lib/services/catalogue";
import {
  ajouterLigneManuelle,
  calculerPropositions,
  commandeVue,
  confirmerEnvoi,
  genererBrouillons,
  messageWhatsApp,
  preparerCommande,
  validerCommande,
} from "@/lib/services/commandes";
import { ouvrirComptage, saisirLigneComptage, validerComptage } from "@/lib/services/comptages";
import { chargerMoteur } from "@/lib/services/moteur";
import { enregistrerPhoto } from "@/lib/services/photos";
import { declarerPerte } from "@/lib/services/pertes";
import { creerReception, receptionVue, saisirControles, saisirLigneReception, validerReception } from "@/lib/services/receptions";
import { signalerRupture } from "@/lib/services/ruptures";
import { quantitesEnCommande, stockTheorique } from "@/lib/services/stock";
import {
  annulerTache,
  creerTachePonctuelle,
  genererTachesDuJour,
  remonterTachesEnRetard,
  saisirValeurs,
  tachesDuPoste,
  tachesRemonteesPour,
  terminerTache,
} from "@/lib/services/taches";
import { acteurPour, baseDisponible, idArticle, idFamille, idFournisseur, maintenant, PHOTO, reinitialiserBase, type ActeurTest } from "./base";

const disponible = await baseDisponible();

describe.skipIf(!disponible)("cycle complet comptage, commande, réception", () => {
  let cuisine: ActeurTest;
  let achats: ActeurTest;
  let manager: ActeurTest;
  let owner: ActeurTest;
  let grill: ActeurTest;
  let viande: number;
  let cheddar: number;
  let boucher: number;
  let commandeViande: number;
  let qteViande: number;

  beforeAll(async () => {
    await reinitialiserBase();
    cuisine = await acteurPour("Responsable cuisine", "Youssef");
    achats = await acteurPour("Responsable achats", "Salma");
    manager = await acteurPour("Manager", "Nadia");
    owner = await acteurPour("Propriétaire — Mamoune", "Mamoune");
    grill = await acteurPour("Grill et montage", "Hamza");
    viande = await idArticle("Viande hachée fraîche (80/20)");
    cheddar = await idArticle("Cheddar en tranches");
    boucher = await idFournisseur("Boucherie (viande)");
    await db.update(schema.fournisseurs).set({ whatsapp: "06 12 34 56 78", contact: "Si Ahmed", statut: "actif" }).where(eq(schema.fournisseurs.id, boucher));
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  it("le comptage du matin recale le stock, sans alerte au premier comptage", async () => {
    maintenant("2026-11-06T08:45:00+01:00");
    const c = await ouvrirComptage(cuisine, await idFamille("Frais et préparations maison"));
    await saisirLigneComptage(cuisine, c.id, viande, 10);
    const r = await validerComptage(cuisine, c.id);
    expect(r.alertes).toBe(0);
    expect(await stockTheorique(viande)).toBeCloseTo(10, 6);
    const ligne = r.lignes.find((l) => l.articleId === viande)!;
    expect(ligne.quantiteComptee).toBe(10);
    expect(ligne.stockTheorique).toBe(0);
  });

  it("un vendredi, la viande proposée couvre samedi et dimanche, jamais une livraison un dimanche", async () => {
    maintenant("2026-11-06T15:00:00+01:00");
    const groupes = await calculerPropositions("2026-11-06");
    const g = groupes.find((x) => x.fournisseur?.id === boucher)!;
    expect(g.dateLivraison).toBe("2026-11-07");
    const l = g.lignes.find((x) => x.articleId === viande)!;
    expect(l.jours).toEqual(["2026-11-07", "2026-11-08"]);
    expect(l.joursSecurite).toEqual([]);
    const { moteur } = await chargerMoteur();
    const besoin = moteur.besoinAchat(viande, "2026-11-07") + moteur.besoinAchat(viande, "2026-11-08");
    const consoVendredi = moteur.besoinAchat(viande, "2026-11-06");
    expect(l.besoin).toBeCloseTo(besoin, 6);
    expect(l.aCommanderComptage).toBeCloseTo(besoin - (10 - consoVendredi), 6);
    expect(l.aCommanderUnites).toBe(Math.ceil(besoin - (10 - consoVendredi)));
    // Le samedi, la prochaine livraison possible est le mardi : rien n'est proposé pour un dimanche.
    const samedi = await calculerPropositions("2026-11-07");
    expect(samedi.find((x) => x.fournisseur?.id === boucher)?.dateLivraison).toBe("2026-11-10");
  });

  it("les articles jamais comptés ne sont pas proposés", async () => {
    const groupes = await calculerPropositions("2026-11-06");
    const tous = groupes.flatMap((g) => g.lignes.map((l) => l.articleId));
    expect(tous).not.toContain(cheddar);
  });

  it("brouillon, envoi WhatsApp pré-rempli, « envoyée » seulement après confirmation", async () => {
    const ids = await genererBrouillons(achats, "2026-11-06");
    const [c] = await db.select().from(schema.commandes).where(and(eq(schema.commandes.fournisseurId, boucher), eq(schema.commandes.statut, "brouillon")));
    expect(ids).toContain(c.id);
    commandeViande = c.id;
    const vue = (await commandeVue(c.id))!;
    qteViande = vue.lignes.find((l) => l.articleId === viande)!.qteCommandee;
    expect(qteViande).toBeGreaterThan(0);
    expect(await preparerCommande(achats, c.id)).toBe("prete");
    const m = await messageWhatsApp(c.id, "Salma");
    expect(m.url).toMatch(/^https:\/\/wa\.me\/212612345678\?text=/);
    expect(m.texte).toContain("Bonjour Si Ahmed");
    expect(m.texte).toContain("samedi 7 novembre");
    expect(m.texte).toContain("Viande hachée fraîche (80/20)");
    expect(m.texte).toContain("Salma, Easy Burger");
    const [avant] = await db.select().from(schema.commandes).where(eq(schema.commandes.id, c.id));
    expect(avant.statut).toBe("prete");
    await confirmerEnvoi(achats, c.id, m.texte);
    const [apres] = await db.select().from(schema.commandes).where(eq(schema.commandes.id, c.id));
    expect(apres.statut).toBe("envoyee");
    expect(apres.envoyeeParPersonneId).toBe(achats.personneId);
    expect((await quantitesEnCommande()).get(viande)).toBeCloseTo(qteViande, 6);
  });

  it("un fournisseur soumis à validation passe par les propriétaires", async () => {
    const emballages = await idFournisseur("Emballages et stickers");
    const boite = await idArticle("Boîte burger");
    const id = await ajouterLigneManuelle(achats, emballages, boite, 2);
    expect(await preparerCommande(achats, id)).toBe("en_attente_validation");
    const alertes = await db.select().from(schema.alertes).where(eq(schema.alertes.type, "commande_a_valider"));
    expect(alertes.some((a) => a.objetId === id && a.roles.includes("proprietaire"))).toBe(true);
    await expect(validerCommande(owner, id, false, null)).rejects.toThrow(/commentaire/);
    await validerCommande(owner, id, true, null);
    const [c] = await db.select().from(schema.commandes).where(eq(schema.commandes.id, id));
    expect(c.statut).toBe("prete");
  });

  it("la clôture du vendredi passe la production et la consommation théoriques", async () => {
    maintenant("2026-11-06T23:20:00+01:00");
    const { rapport } = await cloturerJournee(manager, "2026-11-06", { caRealise: 18760, couverts: 410, especes: 6000, carte: 12760, manquant: 0, faitMarquant: "RAS" });
    expect(rapport).toContain("CA réalisé");
    const boulettes = await idArticle("Boulettes smash pressées");
    const mvts = await db.select().from(schema.mouvementsStock).where(eq(schema.mouvementsStock.origineType, "journee:2026-11-06"));
    const prodBoulettes = mvts.find((m) => m.articleId === boulettes && m.nature === "production");
    const consoViande = mvts.filter((m) => m.articleId === viande && m.nature === "consommation").reduce((s, m) => s + Number(m.quantite), 0);
    expect(prodBoulettes).toBeDefined();
    // La viande baisse avec les boulettes pressées (70 g) et la viande des Loaded Beef Fries.
    expect(-consoViande).toBeGreaterThan(Number(prodBoulettes!.quantite) * 0.07 * 0.99);
    // Rejouer la clôture ne double rien : les mouvements précédents sont annulés par correction.
    await cloturerJournee(manager, "2026-11-06", { caRealise: 18760 });
    const net = (await db.select().from(schema.mouvementsStock).where(eq(schema.mouvementsStock.origineType, "journee:2026-11-06")))
      .filter((m) => m.articleId === viande)
      .reduce((s, m) => s + Number(m.quantite), 0);
    expect(net).toBeCloseTo(consoViande, 6);
  });

  it("réception à l'aveugle : aucune quantité commandée avant validation, photo obligatoire", async () => {
    maintenant("2026-11-07T08:30:00+01:00");
    const id = await creerReception(manager, { fournisseurId: boucher, parSuppleant: false });
    const vue0 = (await receptionVue(id))!;
    expect(vue0.reception.commandeId).toBe(commandeViande);
    expect(vue0.lignes).toHaveLength(0);
    expect(vue0.articlesFournisseur.map((a) => a.id)).toContain(viande);
    await saisirLigneReception(manager, id, viande, { qteRecue: qteViande - 2 });
    const vue1 = (await receptionVue(id))!;
    expect(vue1.lignes[0].qteCommandee).toBeNull();
    expect(await validerReception(manager, id)).toEqual({ ok: false, erreur: expect.stringMatching(/photo/i) });
    await enregistrerPhoto(manager, "reception", id, PHOTO);
    expect(await validerReception(manager, id)).toEqual({ ok: false, erreur: expect.stringMatching(/décision/i) });
    await saisirControles(manager, id, { temperature: 2.5, dlcOk: true, emballagesOk: true, aspectOk: true, decision: "accepte" });
    const r = await validerReception(manager, id);
    expect(r.ok).toBe(true);
    const vue2 = (await receptionVue(id))!;
    const l = vue2.lignes.find((x) => x.articleId === viande)!;
    expect(l.etat).toBe("ecart");
    expect(l.qteCommandee).toBeCloseTo(qteViande, 6);
    const [c] = await db.select().from(schema.commandes).where(eq(schema.commandes.id, commandeViande));
    expect(c.statut).toBe("recue_partiellement");
    // Le manque revient dans les lignes à commander, à confirmer par la responsable achats.
    const brouillons = await db.select().from(schema.commandes).where(and(eq(schema.commandes.fournisseurId, boucher), eq(schema.commandes.statut, "brouillon")));
    const lignes = await db.select().from(schema.commandeLignes).where(eq(schema.commandeLignes.commandeId, brouillons[0].id));
    expect(lignes.find((x) => x.articleId === viande && x.origine === "reception")).toBeDefined();
    const alertes = await db.select().from(schema.alertes).where(eq(schema.alertes.type, "ecart_reception"));
    expect(alertes.some((a) => a.roles.includes("resp_achats") && a.roles.includes("proprietaire"))).toBe(true);
    // Une réception validée ne se modifie plus.
    await expect(saisirLigneReception(manager, id, viande, { qteRecue: 1 })).rejects.toThrow(/rectificative/);
  });

  it("le stock théorique suit comptage, consommation et réception", async () => {
    const [conso] = await db.execute<{ total: string }>(
      // consommation du vendredi, postérieure au comptage du matin
      (await import("drizzle-orm")).sql`select coalesce(sum(quantite),0) as total from mouvements_stock where article_id = ${viande} and origine_type = 'journee:2026-11-06'`,
    );
    expect(await stockTheorique(viande)).toBeCloseTo(10 + Number(conso.total) + (qteViande - 2), 6);
  });

  it("un article commandé mais non saisi ressort « non livré » et revient à commander", async () => {
    maintenant("2026-11-07T15:00:00+01:00");
    const primeur = await idFournisseur("Primeur (fruits et légumes)");
    const tomates = await idArticle("Tomates");
    const salade = await idArticle("Salade iceberg");
    const cmd = await ajouterLigneManuelle(achats, primeur, tomates, 5);
    await ajouterLigneManuelle(achats, primeur, salade, 3);
    await preparerCommande(achats, cmd);
    await confirmerEnvoi(achats, cmd, "message");
    maintenant("2026-11-08T08:30:00+01:00");
    const rec = await creerReception(manager, { fournisseurId: primeur, parSuppleant: false });
    await saisirLigneReception(manager, rec, tomates, { qteRecue: 5 });
    await enregistrerPhoto(manager, "reception", rec, PHOTO);
    await saisirControles(manager, rec, { decision: "accepte" });
    expect((await validerReception(manager, rec)).ok).toBe(true);
    const vue = (await receptionVue(rec))!;
    expect(vue.lignes.find((l) => l.articleId === tomates)!.etat).toBe("conforme");
    expect(vue.lignes.find((l) => l.articleId === salade)!.etat).toBe("non_livre");
    const brouillon = await db.select().from(schema.commandes).where(and(eq(schema.commandes.fournisseurId, primeur), eq(schema.commandes.statut, "brouillon")));
    const lignes = await db.select().from(schema.commandeLignes).where(eq(schema.commandeLignes.commandeId, brouillon[0].id));
    expect(lignes.find((l) => l.articleId === salade)?.origine).toBe("reception");
  });

  it("un fournisseur créé sur le terrain est utilisable aussitôt et signalé « à vérifier »", async () => {
    const id = await creerFournisseurTerrain(manager, { nom: "Boulangerie du quartier", whatsapp: "+212 600 000 000", articleIds: [] });
    const [f] = await db.select().from(schema.fournisseurs).where(eq(schema.fournisseurs.id, id));
    expect(f.statut).toBe("a_verifier");
    const alertes = await db.select().from(schema.alertes).where(eq(schema.alertes.cleUnique, `fiche_fournisseur:${id}`));
    expect(alertes[0].roles).toContain("proprietaire");
    const rec = await creerReception(manager, { fournisseurId: id, parSuppleant: false });
    expect(rec).toBeGreaterThan(0);
  });

  it("une rupture structurante alerte et crée la tâche « Appeler les propriétaires » ; la réception la lève", async () => {
    maintenant("2026-11-08T12:00:00+01:00");
    await signalerRupture(cuisine, cuisine.poste, cheddar, "Plus une tranche");
    const [alerte] = await db.select().from(schema.alertes).where(eq(schema.alertes.cleUnique, `rupture:${cheddar}`));
    expect(alerte.niveau).toBe("critique");
    expect(alerte.roles).toEqual(expect.arrayContaining(["proprietaire", "manager", "resp_achats"]));
    const taches = await tachesDuPoste(cuisine.posteId, "2026-11-08");
    expect(taches.find((t) => t.titre.startsWith("Appeler les propriétaires"))?.structurante).toBe(true);
    // Ligne prioritaire, même si l'article n'a jamais été compté.
    const groupes = await calculerPropositions("2026-11-08");
    const ligne = groupes.flatMap((g) => g.lignes).find((l) => l.articleId === cheddar)!;
    expect(ligne.enRupture).toBe(true);
    expect(ligne.origine).toBe("rupture");
    // Réception de cheddar : la rupture se lève.
    const grossiste = await idFournisseur("Grossiste épicerie et surgelés");
    const rec = await creerReception(manager, { fournisseurId: grossiste, parSuppleant: false });
    await saisirLigneReception(manager, rec, cheddar, { qteRecue: 400 });
    await enregistrerPhoto(manager, "reception", rec, PHOTO);
    await saisirControles(manager, rec, { decision: "accepte" });
    expect((await validerReception(manager, rec)).ok).toBe(true);
    const ouvertes = await db.select().from(schema.ruptures).where(and(eq(schema.ruptures.articleId, cheddar), isNull(schema.ruptures.leveeLe)));
    expect(ouvertes).toHaveLength(0);
    const [alerteApres] = await db.select().from(schema.alertes).where(eq(schema.alertes.id, alerte.id));
    expect(alerteApres.traiteeLe).not.toBeNull();
  });

  it("un prix en hausse de plus de 3 % sur un article structurant alerte avec l'ancien et le nouveau prix", async () => {
    const [af] = await db.select().from(schema.articleFournisseurs).where(and(eq(schema.articleFournisseurs.articleId, viande), eq(schema.articleFournisseurs.fournisseurId, boucher)));
    await enregistrerPrix(owner, { articleFournisseurId: af.id, montant: 80, tvaPct: 0, estTtc: false, date: "2026-11-01" });
    await enregistrerPrix(owner, { articleFournisseurId: af.id, montant: 84, tvaPct: 0, estTtc: false, date: "2026-11-08" });
    const alertes = await db.select().from(schema.alertes).where(eq(schema.alertes.type, "hausse_prix"));
    expect(alertes.some((a) => a.detail?.includes("80.00 → 84.00"))).toBe(true);
    // Un prix TTC se stocke hors taxe.
    await enregistrerPrix(owner, { articleFournisseurId: af.id, montant: 96, tvaPct: 20, estTtc: true, date: "2026-11-09" });
    const [dernier] = await db.select().from(schema.prix).where(eq(schema.prix.articleFournisseurId, af.id)).orderBy((await import("drizzle-orm")).desc(schema.prix.id)).limit(1);
    expect(Number(dernier.prixHt)).toBeCloseTo(80, 6);
  });

  it("une perte déclarée sort du stock", async () => {
    const avant = await stockTheorique(viande);
    await declarerPerte(cuisine, { articleId: viande, quantite: 1.5, motif: "chaine_du_froid" });
    expect(await stockTheorique(viande)).toBeCloseTo(avant - 1.5, 6);
  });
});

describe.skipIf(!disponible)("tâches, preuves et remontée par strates", () => {
  let cuisine: ActeurTest;
  let grill: ActeurTest;
  let serveur: ActeurTest;

  beforeAll(async () => {
    await reinitialiserBase();
    cuisine = await acteurPour("Responsable cuisine", "Youssef");
    grill = await acteurPour("Grill et montage", "Hamza");
    serveur = await acteurPour("Serveur", "Ilyas");
    maintenant("2026-11-06T07:00:00+01:00");
    expect(await genererTachesDuJour("2026-11-06")).toBeGreaterThan(20);
    // Rejouable : aucune tâche en double.
    expect(await genererTachesDuJour("2026-11-06")).toBe(0);
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  it("aucune tâche le lundi, jour de fermeture", async () => {
    expect(await genererTachesDuJour("2026-11-09")).toBe(0);
  });

  it("une tâche avec photos ne se valide pas sans le minimum, et en accepte plusieurs", async () => {
    maintenant("2026-11-06T15:30:00+01:00");
    const t = (await tachesDuPoste(grill.posteId, "2026-11-06")).find((x) => x.titre.includes("après le midi"))!;
    expect(t.preuve).toBe("photos");
    expect(await terminerTache(grill, t.id)).toEqual({ ok: false, erreur: expect.stringMatching(/photo/) });
    await enregistrerPhoto(grill, "tache", t.id, PHOTO);
    await enregistrerPhoto(grill, "tache", t.id, PHOTO);
    expect(await terminerTache(grill, t.id)).toEqual({ ok: true });
  });

  it("une tâche créée par un responsable apparaît aussitôt chez le poste, qui ne peut ni la modifier ni l'annuler", async () => {
    const id = await creerTachePonctuelle(cuisine, cuisine.poste, { posteId: grill.posteId, titre: "Dégraisser la hotte", preuve: "aucune" });
    const taches = await tachesDuPoste(grill.posteId, "2026-11-06");
    expect(taches.find((t) => t.id === id)?.creeParPersonneId).toBe(cuisine.personneId);
    await expect(annulerTache(grill, "employe", id)).rejects.toThrow(/créateur/);
    await expect(creerTachePonctuelle(cuisine, cuisine.poste, { posteId: serveur.posteId, titre: "Hors périmètre", preuve: "aucune" })).rejects.toThrow(/périmètre/);
  });

  it("une tâche de cuisine en retard remonte au responsable cuisine ; structurante, aussi aux propriétaires", async () => {
    maintenant("2026-11-06T16:30:00+01:00");
    await remonterTachesEnRetard(new Date());
    const remontees = await tachesRemonteesPour("resp_cuisine", "2026-11-06");
    expect(remontees.some((t) => t.posteId !== cuisine.posteId && t.statut === "en_retard")).toBe(true);
    const releve = (await tachesDuPoste(cuisine.posteId, "2026-11-06")).find((t) => t.titre.startsWith("Relevé des températures des 6"))!;
    expect(releve.statut).toBe("en_retard");
    const alertes = await db.select().from(schema.alertes).where(eq(schema.alertes.cleUnique, `tache:${releve.id}:en_retard`));
    expect(alertes[0].type).toBe("tache_structurante");
    expect(alertes[0].roles).toEqual(expect.arrayContaining(["manager", "proprietaire"]));
    const pourProprietaires = await tachesRemonteesPour("proprietaire", "2026-11-06");
    expect(pourProprietaires.some((t) => t.id === releve.id)).toBe(true);
  });

  it("une température hors plage crée immédiatement une alerte chez la manager", async () => {
    const releve = (await tachesDuPoste(cuisine.posteId, "2026-11-06")).find((t) => t.titre.startsWith("Relevé des températures des 6"))!;
    const r = await saisirValeurs(cuisine, releve.id, [3, 2, 9, 3, 1, 4]);
    expect(r.horsPlage).toEqual(["Frigo 3 : 9"]);
    const alertes = await db.select().from(schema.alertes).where(eq(schema.alertes.type, "temperature"));
    expect(alertes[0].roles).toContain("manager");
    expect(alertes[0].detail).toMatch(/ne rien jeter, ne rien utiliser/);
    expect(await terminerTache(cuisine, releve.id)).toEqual({ ok: true });
  });
});

describe("mouvements théoriques (partie pure)", () => {
  it("la vente consomme les préparations de la fiche, la production consomme les ingrédients", async () => {
    const { construireDonneesMoteur } = await import("@/lib/donnees-initiales/construire");
    const d = construireDonneesMoteur();
    const easy = d.idProduit("Easy");
    const citronnade = d.idProduit("Citronnade");
    const boulettes = d.idArticle("Boulettes smash pressées");
    const viande = d.idArticle("Viande hachée fraîche (80/20)");
    const concentre = d.idArticle("Concentré de citronnade");
    const r = calculerMouvements(d, new Map([[easy, 100], [citronnade, 10]]), new Map([[boulettes, 120]]));
    expect(r.consommation.get(boulettes)).toBeCloseTo(100, 9);
    expect(r.production.get(boulettes)).toBe(120);
    expect(r.consommation.get(viande)).toBeCloseTo(120 * 0.07, 9);
    // La citronnade servie est faite au service : elle consomme directement le concentré (1 L pour 2,5 L).
    expect(r.consommation.get(concentre)).toBeCloseTo((10 * 0.25) / 2.5, 9);
  });
});

describe.skipIf(!disponible)("coût matière", () => {
  it("se calcule sur les produits critiques avec le stock du matin, les entrées et le stock du soir", async () => {
    await reinitialiserBase();
    const cuisine = await acteurPour("Responsable cuisine", "Youssef");
    const manager = await acteurPour("Manager", "Nadia");
    const owner = await acteurPour("Propriétaire — Taha", "Taha");
    const ids = {
      viande: await idArticle("Viande hachée fraîche (80/20)"),
      pains: await idArticle("Pains burger"),
      cheddar: await idArticle("Cheddar en tranches"),
      pdt: await idArticle("Pommes de terre"),
      tenders: await idArticle("Chicken tenders surgelés"),
    };
    const frais = await idFamille("Frais et préparations maison");
    const prix = async (article: number, fournisseur: string, montant: number) => {
      const [af] = await db
        .select()
        .from(schema.articleFournisseurs)
        .where(and(eq(schema.articleFournisseurs.articleId, article), eq(schema.articleFournisseurs.fournisseurId, await idFournisseur(fournisseur))));
      await enregistrerPrix(owner, { articleFournisseurId: af.id, montant, tvaPct: 0, estTtc: false, date: "2026-11-01" });
    };
    await prix(ids.viande, "Boucherie (viande)", 80); // 80 DH / kg
    await prix(ids.cheddar, "Grossiste épicerie et surgelés", 200); // carton de 400 tranches → 0,5 DH
    await prix(ids.pdt, "Primeur (fruits et légumes)", 100); // sac de 25 kg → 4 DH / kg
    await prix(ids.tenders, "Grossiste épicerie et surgelés", 250); // carton de 5 kg → 50 DH / kg
    // Jeudi soir : comptage de fermeture (sert de stock du matin pour le cheddar et les tenders).
    maintenant("2026-11-05T23:00:00+01:00");
    const jeudi = await ouvrirComptage(cuisine, frais, true);
    for (const [a, q] of [[ids.viande, 12], [ids.pains, 0], [ids.cheddar, 900], [ids.pdt, 60], [ids.tenders, 8]] as const) await saisirLigneComptage(cuisine, jeudi.id, a, q);
    await validerComptage(cuisine, jeudi.id);
    // Vendredi matin : comptage quotidien du frais.
    maintenant("2026-11-06T08:45:00+01:00");
    const matin = await ouvrirComptage(cuisine, frais);
    for (const [a, q] of [[ids.viande, 11.5], [ids.pains, 0], [ids.pdt, 60]] as const) await saisirLigneComptage(cuisine, matin.id, a, q);
    await validerComptage(cuisine, matin.id);
    // Vendredi soir : fermeture.
    maintenant("2026-11-06T23:00:00+01:00");
    const soir = await ouvrirComptage(cuisine, frais, true);
    for (const [a, q] of [[ids.viande, 1.5], [ids.pains, 10], [ids.cheddar, 600], [ids.pdt, 20], [ids.tenders, 6]] as const) await saisirLigneComptage(cuisine, soir.id, a, q);
    await validerComptage(cuisine, soir.id);
    maintenant("2026-11-06T23:20:00+01:00");
    await cloturerJournee(manager, "2026-11-06", { caRealise: 20000 });
    const cm = await coutMatiereDuJour("2026-11-06");
    expect(cm.calculable).toBe(true);
    const ligne = (nom: string) => cm.lignes.find((l) => l.nom === nom)!;
    expect(ligne("Viande hachée fraîche (80/20)").cout).toBeCloseTo((11.5 - 1.5) * 80, 6);
    expect(ligne("Cheddar en tranches").cout).toBeCloseTo((900 - 600) * 0.5, 6);
    expect(ligne("Pommes de terre").cout).toBeCloseTo((60 - 20) * 4, 6);
    expect(ligne("Chicken tenders surgelés").cout).toBeCloseTo((8 - 6) * 50, 6);
    const pains = ligne("Pains burger");
    expect(pains.receptions).toBeGreaterThan(0); // production de la fiche
    expect(pains.cout).toBeCloseTo((0 + pains.receptions - 10) * 1.5, 6);
    const total = cm.lignes.reduce((s, l) => s + (l.cout ?? 0), 0);
    expect(cm.pct).toBeCloseTo(total / 20000, 9);
    vi.useRealTimers();
  });
});
