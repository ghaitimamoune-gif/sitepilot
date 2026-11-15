/**
 * Développement et recette uniquement : vide le schéma public et le recrée.
 * Refuse de s'exécuter si NODE_ENV=production.
 */
import "dotenv/config";
import postgres from "postgres";

async function main() {
  if (process.env.NODE_ENV === "production") {
    console.error("Refusé en production.");
    process.exit(1);
  }
  const url = process.env.DATABASE_URL ?? "postgres://eb:eb@localhost:5432/easyburger";
  const sql = postgres(url, { max: 1 });
  await sql.unsafe("DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public; DROP SCHEMA IF EXISTS drizzle CASCADE;");
  console.log("Schéma réinitialisé. Lancez : npm run db:migrate && npm run db:seed");
  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
