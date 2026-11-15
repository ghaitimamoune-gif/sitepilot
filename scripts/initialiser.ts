/**
 * Initialisation de production : charge les données initiales SEULEMENT si la base est vide,
 * sans aucun code PIN connu. Sans effet sur une base déjà en service : il peut donc être
 * enchaîné à chaque déploiement (npm run db:migrate && npm run db:initialiser && npm run build).
 *
 * L'inscription du premier propriétaire se fait ensuite par le lien d'installation
 * (/installation?jeton=… avec le jeton de la variable INSTALLATION_TOKEN).
 */
import "dotenv/config";

async function main() {
  const { db, schema, sql } = await import("../lib/db");
  const postes = await db.select({ id: schema.postes.id }).from(schema.postes).limit(1);
  if (postes.length > 0) {
    console.log("Base déjà initialisée : aucune modification.");
  } else {
    const { chargerDonneesInitiales } = await import("../lib/donnees-initiales/charger");
    await chargerDonneesInitiales(db, (m) => console.log(m), { pinsInconnus: true });
    console.log("Base initialisée. Aucun code PIN n'est défini : inscription par le lien d'installation.");
  }
  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
