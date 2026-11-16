/**
 * Données de démonstration pour la recette sur téléphone (jamais en production).
 * À appeler sur une base migrée et vide : données initiales avec les codes de démonstration,
 * puis un historique réaliste (4 semaines de chiffre d'affaires, prix, comptages, une livraison
 * attendue, une commande à valider, une rupture, un écart de stock, une perte, les tâches du jour).
 * Utilisé par `npm run demo` et par le point d'accès protégé /api/demo (mode test en ligne).
 */
import { and, eq } from "drizzle-orm";
import { db, schema, sql } from "@/lib/db";
import { chargerDonneesInitiales } from "@/lib/donnees-initiales/charger";
import { normaliserPrenom } from "@/lib/auth/prenom";
import * as D from "@/lib/dates";
import { chargerCalendrier } from "@/lib/services/calendrier";
import { chargerMoteur } from "@/lib/services/moteur";
import { enregistrerPrix } from "@/lib/services/catalogue";
import { ouvrirComptage, saisirLigneComptage, validerComptage } from "@/lib/services/comptages";
import { ajouterLigneManuelle, confirmerEnvoi, genererBrouillons, preparerCommande } from "@/lib/services/commandes";
import { signalerRupture } from "@/lib/services/ruptures";
import { declarerPerte } from "@/lib/services/pertes";
import { enregistrerPrevision } from "@/lib/services/previsions";
import { genererTachesDuJour } from "@/lib/services/taches";
import { tick } from "@/lib/services/jobs";

export interface ResultatDemo {
  journee: string;
  codeEnrolement: string;
  postes: { nom: string; pin: string }[];
}

/** Vide toutes les tables de l'application (le schéma et l'historique des migrations sont conservés). */
export async function viderBase(): Promise<number> {
  const tables = await sql<{ tablename: string }[]>`select tablename from pg_tables where schemaname = 'public'`;
  if (tables.length === 0) return 0;
  await sql.unsafe(`TRUNCATE ${tables.map((t) => `"public"."${t.tablename}"`).join(", ")} RESTART IDENTITY CASCADE`);
  return tables.length;
}

/** Nombre de postes déjà créés (0 : base vide), ou null si les tables n'existent pas encore. */
export async function nombrePostes(): Promise<number | null> {
  const existe = await sql`select to_regclass('public.postes') as t`;
  if (!existe[0]?.t) return null;
  const n = await sql<{ n: number }[]>`select count(*)::int as n from postes`;
  return n[0]?.n ?? 0;
}

export async function chargerDemo(log: (message: string) => void = () => undefined): Promise<ResultatDemo> {
  if (process.env.NODE_ENV === "production" && process.env.MODE_DEMO !== "1") throw new Error("Refusé en production.");
  log("Données initiales (postes, articles, fiches, tâches)…");
  const init = await chargerDonneesInitiales(db, log);

  const poste = async (nom: string) => (await db.select().from(schema.postes).where(eq(schema.postes.nom, nom)))[0];
  const acteur = async (nomPoste: string, prenom: string) => {
    const p = await poste(nomPoste);
    const [pers] = await db.insert(schema.personnes).values({ posteId: p.id, prenom, prenomNorm: normaliserPrenom(prenom) }).returning();
    return { posteId: p.id, personneId: pers.id, poste: { id: p.id, role: p.role, zone: p.zone, posteSuperieurId: p.posteSuperieurId } };
  };
  const article = async (nom: string) => (await db.select().from(schema.articles).where(eq(schema.articles.nom, nom)))[0];
  const fournisseur = async (nom: string) => (await db.select().from(schema.fournisseurs).where(eq(schema.fournisseurs.nom, nom)))[0];
  const famille = async (nom: string) => (await db.select().from(schema.familles).where(eq(schema.familles.nom, nom)))[0];

  const owner = await acteur("Propriétaire — Mamoune", "Mamoune");
  const manager = await acteur("Manager", "Nadia");
  const achats = await acteur("Responsable achats", "Salma");
  const cuisine = await acteur("Responsable cuisine", "Youssef");
  await acteur("Responsable salle", "Sara");
  await acteur("Grill et montage", "Hamza");

  const J = D.journeeExploitation();
  // Le lundi est fermé : s'il tombe aujourd'hui ou demain, on l'ouvre pour pouvoir tester.
  for (const d of [J, D.ajouterJours(J, 1)]) {
    if (D.jourSemaine(d) === 1) {
      await db.insert(schema.calendrier).values({ date: d, ouvert: true, typeJournee: "semaine", note: "Ouverture exceptionnelle (tests)" }).onConflictDoNothing();
    }
  }
  const cal = await chargerCalendrier();
  const veille = cal.jourOuvertPrecedent(J);

  log("Fournisseurs…");
  const maj = async (nom: string, v: Partial<typeof schema.fournisseurs.$inferInsert>) => db.update(schema.fournisseurs).set(v).where(eq(schema.fournisseurs.nom, nom));
  await maj("Boucherie (viande)", { statut: "actif", contact: "Si Ahmed", joursLivraison: [1, 2, 3, 4, 5, 6], heureLimite: "17:00" });
  await maj("Primeur (fruits et légumes)", { statut: "actif", contact: "Hassan", heureLimite: "18:00" });
  await maj("Grossiste épicerie et surgelés", { statut: "actif", contact: "Rachid", joursLivraison: [2, 5], heureLimite: "16:00" });

  log("Prix d'achat…");
  const prix = async (nomArticle: string, nomFournisseur: string, montant: number, date: string) => {
    const a = await article(nomArticle);
    const f = await fournisseur(nomFournisseur);
    const [af] = await db.select().from(schema.articleFournisseurs).where(and(eq(schema.articleFournisseurs.articleId, a.id), eq(schema.articleFournisseurs.fournisseurId, f.id)));
    if (!af) return;
    await enregistrerPrix(owner, { articleFournisseurId: af.id, montant, tvaPct: 0, estTtc: false, date });
  };
  const ilYa = (n: number) => D.ajouterJours(J, -n);
  const B = "Boucherie (viande)", P = "Primeur (fruits et légumes)", G = "Grossiste épicerie et surgelés", E = "Emballages et stickers";
  await prix("Viande hachée fraîche (80/20)", B, 80, ilYa(12));
  await prix("Viande hachée fraîche (80/20)", B, 85, ilYa(1)); // hausse de 6 % : alerte
  const tarifs: [string, string, number][] = [
    ["Salade iceberg", P, 14], ["Tomates", P, 9], ["Pommes de terre", P, 112], ["Oignons", P, 6], ["Citrons", P, 12],
    ["Cheddar en tranches", G, 240], ["Cheddar râpé", G, 110], ["Mix soft serve", G, 28], ["Frites de patates douces surgelées", G, 280],
    ["Chicken tenders surgelés", G, 310], ["Mayonnaise", G, 135], ["Ketchup Heinz", G, 160], ["Moutarde américaine", G, 38],
    ["Cornichons", G, 120], ["Parmesan râpé", G, 180], ["Crispy onions", G, 90], ["Sauce fromage", G, 70], ["Nutella", G, 95],
    ["Coca Cola", G, 120], ["Coca Zero", G, 120], ["Sprite", G, 110], ["Hawai", G, 115], ["Eau", G, 36], ["Huile de friture", G, 210],
    ["Sucre blanc", G, 400], ["Sucre roux", G, 22], ["Farine", G, 330], ["Chocolat noir", G, 95], ["Œufs", G, 42], ["Miel", G, 80],
    ["Sauce BBQ", G, 60], ["Boîte burger", E, 450], ["Barquette frites", E, 300], ["Sac papier", E, 120], ["Gobelet 33 cl", E, 380],
  ];
  for (const [a, f, m] of tarifs) await prix(a, f, m, ilYa(10));

  log("Historique du chiffre d'affaires (4 semaines)…");
  for (let i = 28; i >= 1; i--) {
    const d = ilYa(i);
    if (!cal.estOuvert(d)) continue;
    const base = cal.typeJournee(d) === "weekend" ? 28315 : 18760;
    const ca = Math.round(base * (1 + 0.09 * Math.sin(i * 1.7)));
    await db.insert(schema.cloturesJournee).values({
      date: d,
      caRealise: String(ca),
      couverts: Math.round(ca / 46),
      especes: String(Math.round(ca * 0.32)),
      carte: String(Math.round(ca * 0.68)),
      manquant: "0",
      source: "saisie",
      posteId: manager.posteId,
      personneId: manager.personneId,
    });
  }

  log("Comptages…");
  const { moteur } = await chargerMoteur();
  const comptageDirect = async (nomFamille: string, date: string, heure: string, quantites: [number, number][], fermeture = false) => {
    const f = await famille(nomFamille);
    const at = D.instantLocal(date, heure);
    const [c] = await db
      .insert(schema.comptages)
      .values({ familleId: f.id, date, fermeture, posteId: cuisine.posteId, personneId: cuisine.personneId, statut: "valide", valideLe: at, modeConsommation: "estime" })
      .returning();
    for (const [articleId, q] of quantites) {
      await db.insert(schema.comptageLignes).values({ comptageId: c.id, articleId, quantiteComptee: String(q), stockTheorique: "0", ecart: String(q), saisiLe: at, personneId: cuisine.personneId });
      await db.insert(schema.mouvementsStock).values({ articleId, nature: "comptage", quantite: String(q), stockApres: String(q), origineType: "comptage", origineId: c.id, posteId: cuisine.posteId, personneId: cuisine.personneId, at });
    }
  };
  // Dernier mercredi : comptage hebdomadaire et mensuel, environ 5 jours de besoin en stock.
  let mercredi = ilYa(1);
  while (D.jourSemaine(mercredi) !== 3) mercredi = D.ajouterJours(mercredi, -1);
  const charge = await chargerMoteur();
  for (const nomFamille of ["Épicerie et crémerie", "Surgelés", "Huile de friture", "Emballages et stickers", "Consommables de salle", "Entretien et hygiène", "Tenues", "Petit matériel"]) {
    const f = await famille(nomFamille);
    const lignes: [number, number][] = [];
    for (const a of charge.articles.values()) {
      if (a.familleId !== f.id || a.statut === "archive") continue;
      let q: number;
      if (a.lieAuxVentes && a.nature !== "preparation") {
        const besoin = moteur.besoinSurJours(a.id, cal.joursOuverts(mercredi, 5));
        q = besoin > 0 ? besoin * (0.8 + ((a.id * 37) % 40) / 100) : 2;
      } else {
        q = ((a.stockMinimum ?? 0) + (a.stockCibleFixe ?? 0)) / 2;
      }
      lignes.push([a.id, a.estPiece ? Math.round(q) : Math.round(q * 10) / 10]);
    }
    await comptageDirect(nomFamille, mercredi, "15:45", lignes);
    log(`  comptage hebdomadaire « ${nomFamille} » : ${lignes.length} articles`);
  }
  const ids = {
    viande: (await article("Viande hachée fraîche (80/20)")).id,
    pains: (await article("Pains burger")).id,
    cheddar: (await article("Cheddar en tranches")).id,
    pdt: (await article("Pommes de terre")).id,
    tenders: (await article("Chicken tenders surgelés")).id,
  };
  // Hier soir : comptage de fermeture des produits critiques.
  await comptageDirect("Frais et préparations maison", veille, "23:00", [[ids.viande, 6], [ids.pains, 12], [ids.cheddar, 900], [ids.pdt, 25], [ids.tenders, 6]], true);
  log("  comptage de fermeture d'hier : fait");
  // Ce matin : comptage quotidien du frais (la viande présente un écart : alerte aux propriétaires).
  const frais = await famille("Frais et préparations maison");
  const c = await ouvrirComptage(cuisine, frais.id);
  const matin: [string, number][] = [
    ["Viande hachée fraîche (80/20)", 4], ["Salade iceberg", 1.5], ["Tomates", 3], ["Pommes de terre", 25], ["Oignons", 4], ["Citrons", 2],
    ["Boulettes smash pressées", 40], ["Pains burger", 0], ["Salade iceberg taillée", 0.3], ["Tomates en rondelles", 0.6],
    ["Oignons rouges en rondelles", 0.8], ["Oignon haché", 0.1], ["Frites taillées et trempées", 5], ["Sauce Easy", 3],
    ["Sweet creamy, sauce finie", 0.6], ["Mayo truffe", 0.4], ["Oignons caramélisés", 0.2], ["Boules de pâte à cookies", 20],
    ["Concentré de citronnade", 4], ["Sirop de sucre", 3],
  ];
  for (const [nom, q] of matin) await saisirLigneComptage(cuisine, c.id, (await article(nom)).id, q);
  log("  comptage du matin saisi, validation…");
  await validerComptage(cuisine, c.id);

  log("Commandes…");
  // Livraison attendue aujourd'hui chez le primeur (commande envoyée hier).
  const primeur = await fournisseur(P);
  const cmd = await ajouterLigneManuelle(achats, primeur.id, (await article("Tomates")).id, 8);
  await ajouterLigneManuelle(achats, primeur.id, (await article("Salade iceberg")).id, 3);
  await ajouterLigneManuelle(achats, primeur.id, (await article("Pommes de terre")).id, 2);
  await ajouterLigneManuelle(achats, primeur.id, (await article("Citrons")).id, 2);
  await db.update(schema.commandes).set({ dateLivraison: J }).where(eq(schema.commandes.id, cmd));
  await preparerCommande(achats, cmd);
  await confirmerEnvoi(achats, cmd, "Commande de démonstration");
  await db.update(schema.commandes).set({ envoyeeLe: D.instantLocal(veille, "16:40") }).where(eq(schema.commandes.id, cmd));
  // Brouillons du jour calculés par le moteur (viande, épicerie…).
  await genererBrouillons(achats);
  // Une commande d'emballages soumise à la validation des propriétaires.
  const emb = await fournisseur(E);
  const cmdEmb = await ajouterLigneManuelle(achats, emb.id, (await article("Boîte burger")).id, 4);
  await ajouterLigneManuelle(achats, emb.id, (await article("Barquette frites")).id, 3);
  await preparerCommande(achats, cmdEmb);

  log("Rupture, perte, prévisionnel, tâches…");
  await signalerRupture(cuisine, cuisine.poste, (await article("Sauce fromage")).id, "Plus de sauce fromage pour les Cheesy Fries");
  await declarerPerte(cuisine, { articleId: (await article("Salade iceberg")).id, quantite: 0.8, motif: "perime" });
  let samedi = D.ajouterJours(J, 1);
  while (D.jourSemaine(samedi) !== 6) samedi = D.ajouterJours(samedi, 1);
  await enregistrerPrevision(owner, samedi, 32500);
  await genererTachesDuJour(J);
  if (cal.estOuvert(D.ajouterJours(J, 1))) await genererTachesDuJour(D.ajouterJours(J, 1));
  const [ouverture] = await db
    .select()
    .from(schema.taches)
    .where(and(eq(schema.taches.posteId, cuisine.posteId), eq(schema.taches.journee, J), eq(schema.taches.titre, "Ouverture cuisine : sécurité et matériel")));
  if (ouverture) {
    await db
      .update(schema.taches)
      .set({ statut: "faite", pointsCoches: ouverture.points.map(() => true), faiteParPersonneId: cuisine.personneId, faiteLe: D.instantLocal(J, "08:05") })
      .where(eq(schema.taches.id, ouverture.id));
  }
  log("Traitements automatiques (alertes, remontées)…");
  await tick(new Date(), true);

  const [code] = await db.select().from(schema.parametres).where(eq(schema.parametres.cle, "code_enrolement"));
  return { journee: J, codeEnrolement: code?.valeur ?? init.codeEnrolement, postes: init.postes };
}
