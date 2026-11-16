import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// DATABASE_URL, ou POSTGRES_URL tel que l'injecte l'intégration Supabase de Vercel.
const url = process.env.DATABASE_URL ?? process.env.POSTGRES_URL ?? "postgres://eb:eb@localhost:5432/easyburger";

declare global {
  // eslint-disable-next-line no-var
  var __ebSql: ReturnType<typeof postgres> | undefined;
}

/**
 * Connexion unique, réutilisée entre les rechargements du serveur de développement.
 *
 * Supabase : utiliser le pooler en mode SESSION (port 5432), pas le mode transaction (6543).
 * Quand toutes ses connexions sont occupées, postgres-js enchaîne les requêtes suivantes sur une
 * connexion déjà occupée (pipelining) ; le mode transaction rend la connexion serveur après la
 * première réponse et la requête suivante n'aboutit jamais (blocage constaté dès que plus de
 * 10 requêtes partent en même temps). En mode session, chaque connexion occupe une connexion du
 * pool Supabase (15 sur l'offre gratuite) : d'où 5 connexions au plus par instance.
 */
export const sql =
  globalThis.__ebSql ??
  postgres(url, {
    max: Number(process.env.DB_CONNEXIONS_MAX ?? 5),
    idle_timeout: 20,
    connect_timeout: 10,
    prepare: false,
    transform: { undefined: null },
  });
if (process.env.NODE_ENV !== "production") globalThis.__ebSql = sql;

export const db = drizzle(sql, { schema });
export type Db = typeof db;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
export { schema };
