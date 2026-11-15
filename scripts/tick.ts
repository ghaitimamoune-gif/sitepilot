/** Exécute le planificateur interne une fois (pour un cron système ou un test manuel). */
import "dotenv/config";

async function main() {
  const { tick } = await import("../lib/services/jobs");
  const r = await tick(new Date(), true);
  console.log(JSON.stringify(r, null, 2));
  const { sql } = await import("../lib/db");
  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
