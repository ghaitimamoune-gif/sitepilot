/**
 * Base de démonstration pour la recette sur téléphone (jamais en production).
 * Repart d'une base vide (schéma recréé, migrations rejouées) puis charge les données de
 * démonstration (voir lib/demo/charger.ts).
 *
 *   DATABASE_URL=postgres://…/easyburger_demo npm run demo
 *   npm run demo:si-vide      (ne fait rien si la base contient déjà des postes)
 */
import "dotenv/config";

async function main() {
  if (process.env.NODE_ENV === "production" && process.env.MODE_DEMO !== "1") throw new Error("Refusé en production.");
  const { db, sql } = await import("../lib/db");
  const { migrate } = await import("drizzle-orm/postgres-js/migrator");
  const { chargerDemo, nombrePostes } = await import("../lib/demo/charger");

  if (process.argv.includes("--si-vide") && ((await nombrePostes()) ?? 0) > 0) {
    console.log("Base déjà chargée : aucune modification.");
    await sql.end();
    return;
  }
  console.log("Base de démonstration : remise à zéro…");
  await sql.unsafe("SET client_min_messages TO WARNING; DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public; DROP SCHEMA IF EXISTS drizzle CASCADE;");
  await migrate(db, { migrationsFolder: "./drizzle" });
  const r = await chargerDemo((m) => console.log(m));
  console.log("\nBase de démonstration prête.");
  console.log(`Journée d'exploitation : ${r.journee}`);
  console.log(`Code d'enrôlement : ${r.codeEnrolement}`);
  for (const p of r.postes) console.log(`  ${p.nom.padEnd(30)} ${p.pin}`);
  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
