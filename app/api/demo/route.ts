import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { secretsEgaux } from "@/lib/auth/crypto";
import { FUSEAU } from "@/lib/dates";
import { chargerDemo, nombrePostes, viderBase } from "@/lib/demo/charger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Version de test en ligne uniquement (MODE_DEMO=1) : charge les données de démonstration
 * depuis le serveur, au plus près de la base, avec un journal détaillé renvoyé au fil de l'eau.
 * Protégé par l'en-tête Authorization: Bearer <CRON_SECRET>. Introuvable hors mode test.
 *
 *   POST /api/demo?action=etat       état de la base (sessions en cours, verrous, nombre de postes)
 *   POST /api/demo?action=liberer    termine les sessions bloquées depuis plus d'une minute
 *   POST /api/demo?action=charger    vide la base puis charge les données de démonstration
 */
export async function POST(req: Request) {
  if (process.env.MODE_DEMO !== "1") return new Response("Introuvable", { status: 404 });
  const secret = process.env.CRON_SECRET;
  const fourni = req.headers.get("authorization") ?? "";
  if (!secret || !secretsEgaux(fourni, `Bearer ${secret}`)) return new Response("Non autorisé", { status: 401 });
  const action = new URL(req.url).searchParams.get("action") ?? "etat";

  const encodeur = new TextEncoder();
  const flux = new ReadableStream<Uint8Array>({
    async start(controller) {
      const t0 = Date.now();
      let derniere = "";
      const log = (m: string) => {
        derniere = m;
        controller.enqueue(encodeur.encode(`${((Date.now() - t0) / 1000).toFixed(1)}s ${m}\n`));
      };
      // Signe de vie : distingue une requête en attente (le battement continue) d'un calcul bloqué.
      const battement = setInterval(() => {
        controller.enqueue(encodeur.encode(`${((Date.now() - t0) / 1000).toFixed(1)}s … toujours en cours (dernière étape : ${derniere.trim()})\n`));
      }, 15_000);
      try {
        if (action === "etat") await etat(log);
        else if (action === "liberer") await liberer(log);
        else if (action === "charger") {
          await liberer(log);
          log(`Tables vidées : ${await viderBase()}`);
          const r = await chargerDemo(log);
          log("Base de démonstration prête.");
          log(`Journée d'exploitation : ${r.journee}`);
          log(`Code d'enrôlement : ${r.codeEnrolement}`);
          log(`Postes créés : ${r.postes.length}`);
        } else log(`Action inconnue : ${action}`);
      } catch (e) {
        log(`ERREUR : ${e instanceof Error ? (e.stack ?? e.message) : String(e)}`);
      } finally {
        clearInterval(battement);
        controller.close();
      }
    },
  });
  return new Response(flux, {
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store", "x-accel-buffering": "no" },
  });
}

async function etat(log: (m: string) => void) {
  log(`Fuseau : ${FUSEAU} (tables ${process.versions.tz ?? "?"}), région ${process.env.VERCEL_REGION ?? "?"}`);
  log(`Postes en base : ${(await nombrePostes()) ?? "tables absentes"}`);
  const sessions = (await db.execute(sql`
    select pid, usename, state,
           nullif(concat_ws(':', wait_event_type, wait_event), '') as attente,
           extract(epoch from now() - xact_start)::int as transaction_s,
           extract(epoch from now() - query_start)::int as requete_s,
           left(regexp_replace(query, '\\s+', ' ', 'g'), 140) as requete
    from pg_stat_activity
    where datname = current_database() and pid <> pg_backend_pid() and state is distinct from 'idle'
    order by xact_start nulls last`)) as unknown as {
    pid: number;
    usename: string | null;
    state: string | null;
    attente: string | null;
    transaction_s: number | null;
    requete_s: number | null;
    requete: string | null;
  }[];
  log(`Sessions non inactives : ${sessions.length}`);
  for (const s of sessions) {
    log(`  pid ${s.pid} ${s.usename ?? "?"} ${s.state ?? "?"} attente=${s.attente ?? "-"} transaction=${s.transaction_s ?? "-"}s requête=${s.requete_s ?? "-"}s : ${s.requete ?? ""}`);
  }
  const [verrous] = (await db.execute(sql`select count(*)::int as n from pg_locks where not granted`)) as unknown as { n: number }[];
  log(`Verrous en attente : ${verrous?.n ?? 0}`);
}

async function liberer(log: (m: string) => void) {
  const r = (await db.execute(sql`
    select pid, state, pg_terminate_backend(pid) as ok
    from pg_stat_activity
    where datname = current_database() and pid <> pg_backend_pid() and usename = current_user
      and state in ('active', 'idle in transaction', 'idle in transaction (aborted)')
      and now() - coalesce(xact_start, query_start) > interval '60 seconds'`)) as unknown as { pid: number; ok: boolean; state: string | null }[];
  log(r.length === 0 ? "Aucune session bloquée." : `Sessions bloquées terminées : ${r.map((s) => `${s.pid} (${s.state}) ${s.ok ? "ok" : "refusé"}`).join(", ")}`);
}
