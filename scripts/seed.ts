/**
 * Chargement des données initiales (sections 14 et 15 du brief). Rejouable.
 *
 *   npm run db:seed
 */
import "dotenv/config";

async function main() {
  const { db, sql } = await import("../lib/db");
  const { chargerDonneesInitiales } = await import("../lib/donnees-initiales/charger");
  const r = await chargerDonneesInitiales(db, (m) => console.log(m));
  console.log("\nDonnées initiales chargées.");
  console.log(`Code d'enrôlement des appareils : ${r.codeEnrolement}`);
  console.log("Codes PIN de départ (à changer dès la mise en service) :");
  for (const p of r.postes) console.log(`  ${p.nom.padEnd(30)} ${p.pin}`);
  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
