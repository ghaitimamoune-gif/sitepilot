import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const url = process.env.DATABASE_URL ?? "postgres://eb:eb@localhost:5432/easyburger";

declare global {
  // eslint-disable-next-line no-var
  var __ebSql: ReturnType<typeof postgres> | undefined;
}

/** Connexion unique, réutilisée entre les rechargements du serveur de développement. */
export const sql =
  globalThis.__ebSql ??
  postgres(url, {
    max: 10,
    idle_timeout: 30,
    connect_timeout: 10,
    prepare: false,
    transform: { undefined: null },
  });
if (process.env.NODE_ENV !== "production") globalThis.__ebSql = sql;

export const db = drizzle(sql, { schema });
export type Db = typeof db;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
export { schema };
