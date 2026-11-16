/**
 * Applique les migrations SQL du dossier drizzle/ (générées par `npx drizzle-kit generate`).
 * Rejouable : les migrations déjà appliquées sont ignorées.
 */
import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

async function main() {
  // Une base verrouillée ne doit pas bloquer une construction indéfiniment.
  const delai = setTimeout(() => {
    console.error("Migrations : délai de 3 minutes dépassé (base injoignable ou verrouillée).");
    process.exit(1);
  }, 180_000);
  delai.unref();
  const url = process.env.DATABASE_URL ?? process.env.POSTGRES_URL ?? "postgres://eb:eb@localhost:5432/easyburger";
  // prepare: false — compatible avec le pooler de connexions de Supabase (mode transaction).
  const sql = postgres(url, { max: 1, prepare: false });
  const db = drizzle(sql);
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("Migrations appliquées.");
  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
