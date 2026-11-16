import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// DATABASE_URL, ou POSTGRES_URL tel que l'injecte l'intégration Supabase de Vercel.
const url = process.env.DATABASE_URL ?? process.env.POSTGRES_URL ?? "postgres://eb:eb@localhost:5432/easyburger";
const MAX_CONNEXIONS = Math.max(2, Number(process.env.DB_CONNEXIONS_MAX ?? 10));

declare global {
  // eslint-disable-next-line no-var
  var __ebSql: ReturnType<typeof postgres> | undefined;
  // eslint-disable-next-line no-var
  var __ebSqlLimite: ReturnType<typeof postgres> | undefined;
}

/**
 * Client brut, réservé aux scripts (migrations, démonstration locale, tests).
 * prepare: false — compatible avec le pooler de connexions de Supabase en mode transaction.
 */
export const sql =
  globalThis.__ebSql ??
  postgres(url, {
    max: MAX_CONNEXIONS,
    idle_timeout: 20,
    connect_timeout: 10,
    prepare: false,
    transform: { undefined: null },
  });

/** File d'attente à jetons : au plus `n` opérations en cours. */
class Jetons {
  private attente: (() => void)[] = [];
  constructor(private libres: number) {}
  prendre(): Promise<void> {
    if (this.libres > 0) {
      this.libres--;
      return Promise.resolve();
    }
    return new Promise((ok) => this.attente.push(ok));
  }
  rendre(): void {
    const suivant = this.attente.shift();
    if (suivant) suivant();
    else this.libres++;
  }
}

/**
 * Supabase (pooler en mode transaction, port 6543) : quand toutes ses connexions sont occupées,
 * postgres-js enchaîne les requêtes suivantes sur une connexion déjà occupée (pipelining). Le
 * pooler rend la connexion serveur dès la première réponse et la requête suivante n'aboutit
 * jamais : la page reste bloquée (constaté dès que plus de 10 requêtes partent en même temps).
 *
 * Ce client limite donc les requêtes (et transactions) simultanées au nombre de connexions :
 * chacune dispose toujours d'une connexion libre, les autres attendent leur tour ici. Les requêtes
 * d'une transaction passent par la connexion réservée de la transaction, sans limite (le pooler
 * garde la connexion serveur jusqu'à la fin de la transaction).
 */
function clientLimite(client: ReturnType<typeof postgres>, max: number): ReturnType<typeof postgres> {
  const jetons = new Jetons(max);
  const executer = <T,>(lancer: () => PromiseLike<T>): Promise<T> =>
    jetons.prendre().then(() => {
      let p: PromiseLike<T>;
      try {
        p = lancer();
      } catch (e) {
        jetons.rendre();
        throw e;
      }
      return Promise.resolve(p).finally(() => jetons.rendre());
    });

  // Même contrat que client.unsafe() pour drizzle : objet « thenable », exécuté quand on l'attend,
  // avec .values() pour obtenir les lignes sous forme de tableaux.
  const unsafe = (requete: string, parametres?: unknown[], options?: unknown) => {
    let valeurs = false;
    let resultat: Promise<unknown> | null = null;
    const lancer = () =>
      (resultat ??= executer(() => {
        const q = client.unsafe(requete, parametres as never, options as never);
        return valeurs ? q.values() : q;
      }));
    const differee = {
      values() {
        valeurs = true;
        return differee;
      },
      then<A = unknown, B = never>(ok?: ((v: unknown) => A | PromiseLike<A>) | null, ko?: ((e: unknown) => B | PromiseLike<B>) | null) {
        return lancer().then(ok, ko);
      },
      catch<B = never>(ko?: ((e: unknown) => B | PromiseLike<B>) | null) {
        return lancer().catch(ko);
      },
      finally(f?: (() => void) | null) {
        return lancer().finally(f);
      },
    };
    return differee;
  };

  return new Proxy(client, {
    get(cible, propriete, recepteur) {
      if (propriete === "unsafe") return unsafe;
      if (propriete === "begin") {
        return (...args: unknown[]) => executer(() => (cible.begin as (...a: unknown[]) => Promise<unknown>)(...args));
      }
      return Reflect.get(cible, propriete, recepteur);
    },
  });
}

const sqlLimite = globalThis.__ebSqlLimite ?? clientLimite(sql, MAX_CONNEXIONS);
if (process.env.NODE_ENV !== "production") {
  // Connexions réutilisées entre les rechargements du serveur de développement.
  globalThis.__ebSql = sql;
  globalThis.__ebSqlLimite = sqlLimite;
}

export const db = drizzle(sqlLimite, { schema });
export type Db = typeof db;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
export { schema };
