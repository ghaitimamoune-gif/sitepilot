/**
 * Parcours de bout en bout dans un vrai navigateur, sur un écran de 360 pixels de large.
 * Reprend les critères d'acceptation de la section 16 du brief qui passent par l'interface.
 *
 *   DATABASE_URL=… E2E_URL=http://localhost:3100 npx tsx tests/e2e/parcours.ts
 *
 * La base doit être fraîchement chargée (npm run db:reset && db:migrate && db:seed).
 */
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import path from "node:path";
import postgres from "postgres";

const require = createRequire(import.meta.url);
// Playwright est préinstallé dans l'environnement de recette, hors des dépendances du projet.
// Types volontairement lâches : Playwright n'est pas une dépendance du projet.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Page = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Browser = any;
const { chromium } = require("playwright") as { chromium: { launch: () => Promise<Browser> } };

const BASE = process.env.E2E_URL ?? "http://localhost:3100";
const CAPTURES = process.env.E2E_CAPTURES ?? path.resolve("e2e-captures");
const sql = postgres(process.env.DATABASE_URL ?? "postgres://eb:eb@localhost:5432/easyburger_e2e", { max: 2 });

const resultats: { nom: string; ok: boolean; detail?: string }[] = [];
const debordements: string[] = [];
const petitesCibles = new Map<string, string[]>();

async function etape(nom: string, fn: () => Promise<void>) {
  try {
    await fn();
    resultats.push({ nom, ok: true });
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    resultats.push({ nom, ok: false, detail: e instanceof Error ? e.message : String(e) });
    console.log(`  ✗ ${nom}\n      ${e instanceof Error ? e.message.split("\n")[0] : e}`);
  }
}

function attendu(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function telephone(browser: Browser, echelle = 1) {
  const ctx = await browser.newContext({
    viewport: { width: 360, height: 780 },
    deviceScaleFactor: echelle,
    isMobile: true,
    hasTouch: true,
    locale: "fr-FR",
    timezoneId: "Africa/Casablanca",
  });
  return { ctx, page: await ctx.newPage() };
}

async function codeEnrolement(): Promise<string> {
  const [r] = await sql`select valeur from parametres where cle = 'code_enrolement'`;
  return r.valeur as string;
}

async function enroler(page: Page) {
  await page.goto(`${BASE}/enroler`);
  await page.fill('input[name="code"]', await codeEnrolement());
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/connexion$/);
}

async function taperPin(page: Page, pin: string) {
  for (const c of pin) await page.click(`button[aria-label="${c}"]`);
  if (pin.length === 4) await page.click('button:has-text("Entrer")');
}

async function connexion(page: Page, pin: string, prenom: string) {
  await page.goto(`${BASE}/connexion`);
  await taperPin(page, pin);
  await page.waitForURL(/\/connexion\/prenom/);
  const bouton = page.locator(`button.display:has-text("${prenom}")`);
  if ((await bouton.count()) > 0) await bouton.first().click();
  else {
    await page.fill("form input", prenom);
    await page.click('form button[type="submit"]');
  }
  await page.waitForURL((u: URL) => !u.pathname.startsWith("/connexion"));
}

async function sortir(page: Page) {
  await page.goto(`${BASE}/plus`);
  await page.click('button:has-text("Sortir")');
  await page.waitForURL(/\/connexion$/);
}

/** Vérifie l'absence de défilement horizontal et relève les cibles tactiles de moins de 44 px. */
async function controlerEcran(page: Page, nom: string) {
  const largeur = await page.evaluate(() => document.documentElement.scrollWidth);
  if (largeur > 361) debordements.push(`${nom} : ${largeur}px`);
  const petites = await page.evaluate(() => {
    const res: string[] = [];
    for (const el of Array.from(document.querySelectorAll("main a, main button, main input, main select, nav a"))) {
      const r = (el as HTMLElement).getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (["checkbox", "hidden", "file"].includes((el as HTMLInputElement).type)) continue;
      if (r.height < 43.5) res.push(`${el.tagName.toLowerCase()} « ${(el.textContent || (el as HTMLInputElement).placeholder || "").trim().slice(0, 30)} » ${Math.round(r.height)}px`);
    }
    return res;
  });
  if (petites.length > 0) petitesCibles.set(nom, petites);
}

async function capture(page: Page, nom: string) {
  await controlerEcran(page, nom);
  await page.screenshot({ path: path.join(CAPTURES, `${nom}.png`), fullPage: true });
}

async function main() {
  mkdirSync(CAPTURES, { recursive: true });
  const browser = await chromium.launch();
  console.log(`Parcours sur ${BASE}`);

  await etape("Un téléphone non enrôlé n'affiche pas l'écran du code PIN", async () => {
    const { ctx, page } = await telephone(browser);
    await page.goto(`${BASE}/connexion`);
    attendu(page.url().endsWith("/enroler"), `redirigé vers ${page.url()}`);
    attendu((await page.locator('button[aria-label="1"]').count()) === 0, "le clavier PIN est visible");
    await page.goto(`${BASE}/taches`);
    attendu(page.url().endsWith("/enroler"), "une page interne est accessible sans enrôlement");
    await page.fill('input[name="code"]', "FAUX-CODE-0000-0000");
    await page.click('button[type="submit"]');
    await page.waitForSelector("text=Code d'enrôlement incorrect");
    await capture(page, "01-enrolement");
    await ctx.close();
  });

  await etape("Cinq codes erronés bloquent le poste 5 minutes sur cet appareil", async () => {
    const { ctx, page } = await telephone(browser);
    await enroler(page);
    await capture(page, "02-code-pin");
    for (let i = 0; i < 5; i++) {
      await taperPin(page, "9999");
      await page.waitForSelector("p[role=alert]");
    }
    await page.waitForSelector("text=bloqué");
    // Même le bon code est refusé pendant le verrouillage.
    await page.goto(`${BASE}/connexion`);
    await page.waitForSelector("text=Trop de codes erronés");
    attendu((await page.locator('button[aria-label="1"]').count()) === 0, "le clavier reste disponible");
    const [n] = await sql`select count(*)::int as n from tentatives_pin where reussie = false`;
    attendu(n.n >= 5, "tentatives non journalisées");
    await ctx.close();
  });

  await etape("« youssef » et « Youssef » sont reconnus comme la même personne", async () => {
    const { ctx, page } = await telephone(browser);
    await enroler(page);
    await connexion(page, "3000", "youssef");
    await sortir(page);
    await taperPin(page, "3000");
    await page.waitForURL(/\/connexion\/prenom/);
    attendu((await page.locator('button.display:has-text("Youssef")').count()) === 1, "le prénom n'est pas proposé en un appui");
    await capture(page, "03-prenom");
    await page.fill("form input", "Youssef");
    await page.click('form button[type="submit"]');
    await page.waitForURL((u: URL) => !u.pathname.startsWith("/connexion"));
    const [n] = await sql`select count(*)::int as n from personnes p join postes s on s.id = p.poste_id where s.nom = 'Responsable cuisine'`;
    attendu(n.n === 1, `${n.n} personnes au lieu d'une`);
    await ctx.close();
  });

  await etape("La responsable achats ne peut pas ouvrir l'écran des réceptions, même par son adresse directe", async () => {
    const { ctx, page } = await telephone(browser);
    await enroler(page);
    await connexion(page, "2000", "Salma");
    attendu(page.url().endsWith("/commandes"), `accueil ${page.url()}`);
    await capture(page, "04-commandes");
    for (const chemin of ["/receptions", "/receptions/nouvelle", "/receptions/1"]) {
      await page.goto(`${BASE}${chemin}`);
      attendu(page.url().includes("/refuse"), `${chemin} accessible (${page.url()})`);
    }
    await page.waitForSelector("text=La responsable achats ne réceptionne jamais");
    const r = await page.request.post(`${BASE}/api/photos`, { multipart: { objetType: "reception", objetId: "1", fichier: { name: "a.jpg", mimeType: "image/jpeg", buffer: Buffer.from([1, 2, 3]) } } });
    attendu(r.status() === 403, `dépôt de photo de réception : ${r.status()}`);
    await ctx.close();
  });

  await etape("Le responsable cuisine ne modifie aucune quantité calculée ; la manager force, les propriétaires le voient", async () => {
    const cuisine = await telephone(browser);
    await enroler(cuisine.page);
    await connexion(cuisine.page, "3000", "Youssef");
    await cuisine.page.goto(`${BASE}/preparations`);
    await cuisine.page.click("text=Sauce Easy");
    attendu((await cuisine.page.locator("text=Forcer la quantité").count()) === 0, "le forçage est proposé au responsable cuisine");
    attendu((await cuisine.page.locator('input[placeholder="0"]').count()) > 0, "la saisie du reste de la veille manque");
    await capture(cuisine.page, "05-preparations");
    await cuisine.ctx.close();

    const manager = await telephone(browser);
    await enroler(manager.page);
    await connexion(manager.page, "1000", "Nadia");
    await capture(manager.page, "06-accueil-manager");
    await manager.page.goto(`${BASE}/preparations`);
    await manager.page.click("text=Sauce Easy");
    await manager.page.waitForSelector("text=Forcer la quantité");
    await manager.page.fill('input[placeholder="quantité"]', "20");
    await manager.page.fill('input[placeholder="Motif"]', "Match au stade");
    await manager.page.click('button:has-text("Forcer")');
    await manager.page.waitForSelector("text=Forcée");
    await manager.ctx.close();

    const owner = await telephone(browser);
    await enroler(owner.page);
    await connexion(owner.page, "444444", "Mamoune");
    attendu(owner.page.url().endsWith("/pilotage"), `accueil ${owner.page.url()}`);
    await capture(owner.page, "07-pilotage");
    await owner.page.goto(`${BASE}/alertes`);
    await owner.page.waitForSelector("text=Quantité forcée : Sauce Easy");
    await capture(owner.page, "08-alertes");
    await owner.ctx.close();
  });

  await etape("Une tâche avec photos ne se valide pas sans le minimum ; la photo se prend depuis le téléphone", async () => {
    const { ctx, page } = await telephone(browser);
    await enroler(page);
    await connexion(page, "1004", "Hamza");
    attendu(page.url().endsWith("/taches"), `accueil ${page.url()}`);
    await capture(page, "09-taches-poste");
    await page.click("text=Nettoyage de la plaque smash — après le midi");
    await page.waitForURL(/\/taches\/\d+/);
    await page.click("text=C'est fait");
    await page.waitForSelector("text=photo manquante");
    await page.setInputFiles('input[type="file"]', path.resolve("public/icon-512.png"));
    await page.waitForSelector("text=minimum atteint", { timeout: 20000 });
    await capture(page, "10-tache-photo");
    await page.click("text=C'est fait");
    await page.waitForURL(/\/taches$/);
    await ctx.close();
  });

  await etape("Écrans principaux à 360 px : réception, comptage, prévisionnel, clôture", async () => {
    const m = await telephone(browser);
    await enroler(m.page);
    await connexion(m.page, "1000", "Nadia");
    await m.page.goto(`${BASE}/receptions/nouvelle`);
    await capture(m.page, "11-reception-fournisseur");
    await m.page.click("text=Boucherie (viande)");
    await m.page.waitForURL(/\/receptions\/\d+/);
    await m.page.click("text=+ Viande hachée fraîche (80/20)");
    await m.page.waitForSelector('input[placeholder="0"]');
    await m.page.fill('input[placeholder="0"]', "12,5");
    await m.page.waitForSelector("text=Enregistré", { timeout: 10000 });
    attendu((await m.page.locator("text=/commandé \\d/").count()) === 0, "une quantité commandée est visible avant validation");
    attendu(await m.page.locator('button:has-text("Valider la réception")').isDisabled(), "validation possible sans photo");
    await capture(m.page, "12-reception-saisie");
    await m.page.goto(`${BASE}/cloture`);
    await capture(m.page, "13-cloture");
    await m.ctx.close();

    const c = await telephone(browser);
    await enroler(c.page);
    await connexion(c.page, "3000", "Youssef");
    await c.page.goto(`${BASE}/comptages`);
    await capture(c.page, "14-comptages");
    await c.page.click("text=Frais et préparations maison");
    await c.page.waitForURL(/\/comptages\/\d+/);
    await capture(c.page, "15-comptage-saisie");
    await c.ctx.close();

    const o = await telephone(browser);
    await enroler(o.page);
    await connexion(o.page, "111111", "Jaafar");
    await o.page.goto(`${BASE}/previsionnel`);
    await capture(o.page, "16-previsionnel");
    await o.page.goto(`${BASE}/parametres`);
    await capture(o.page, "17-parametres");
    await o.ctx.close();
  });

  await browser.close();
  await sql.end();

  console.log("\nDéfilement horizontal :", debordements.length === 0 ? "aucun" : debordements.join(" ; "));
  if (petitesCibles.size > 0) {
    console.log("Cibles tactiles de moins de 44 px :");
    for (const [ecran, l] of petitesCibles) console.log(`  ${ecran} : ${l.slice(0, 8).join(" | ")}${l.length > 8 ? ` (+${l.length - 8})` : ""}`);
  }
  const echecs = resultats.filter((r) => !r.ok);
  console.log(`\n${resultats.length - echecs.length}/${resultats.length} parcours réussis. Captures : ${CAPTURES}`);
  process.exit(echecs.length > 0 || debordements.length > 0 ? 1 : 0);
}

main().catch(async (e) => {
  console.error(e);
  await sql.end();
  process.exit(1);
});
