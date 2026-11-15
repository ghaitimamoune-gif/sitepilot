import { desc, eq } from "drizzle-orm";
import Link from "next/link";
import { Carte, EnTete, Vide } from "@/components/ui/primitives";
import { exigerDroit } from "@/lib/auth/session";
import { db, schema } from "@/lib/db";
import { instantCourt } from "@/lib/dates";

const PAR_PAGE = 80;

/** Journal complet : rien ne se supprime, chaque action porte le poste, le prénom, la date et l'heure. */
export default async function PageJournal({ searchParams }: { searchParams: Promise<{ page?: string; entite?: string }> }) {
  await exigerDroit("journal:lire");
  const { page: p0, entite } = await searchParams;
  const page = Math.max(1, Number(p0 ?? 1) || 1);
  const rows = await db
    .select({ j: schema.journal, poste: schema.postes.nom, prenom: schema.personnes.prenom })
    .from(schema.journal)
    .leftJoin(schema.postes, eq(schema.postes.id, schema.journal.posteId))
    .leftJoin(schema.personnes, eq(schema.personnes.id, schema.journal.personneId))
    .where(entite ? eq(schema.journal.entite, entite) : undefined)
    .orderBy(desc(schema.journal.at))
    .limit(PAR_PAGE)
    .offset((page - 1) * PAR_PAGE);
  return (
    <>
      <EnTete titre="Journal" sousTitre="Journal d'audit non modifiable : les corrections créent de nouvelles écritures." />
      <form method="get" className="mb-3 flex gap-2">
        <input name="entite" defaultValue={entite ?? ""} className="input flex-1" placeholder="Filtrer par entité (tache, commande, reception, prix…)" />
        <button type="submit" className="btn-ghost">OK</button>
      </form>
      <Carte>
        {rows.length === 0 ? (
          <Vide>Aucune écriture.</Vide>
        ) : (
          <ul className="divide-rows text-sm">
            {rows.map((r) => (
              <li key={r.j.id} className="py-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">
                    {r.j.entite} · {r.j.action}
                    {r.j.entiteId ? ` #${r.j.entiteId}` : ""}
                  </span>
                  <span className="shrink-0 text-xs text-muted">{instantCourt(r.j.at)}</span>
                </div>
                <p className="text-xs text-muted">
                  {r.prenom ?? "système"}
                  {r.poste ? ` · ${r.poste}` : ""}
                </p>
                {(r.j.avant !== null || r.j.apres !== null) && (
                  <details className="text-xs">
                    <summary className="cursor-pointer text-muted">détail</summary>
                    <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap rounded bg-bg p-2">{JSON.stringify({ avant: r.j.avant, apres: r.j.apres }, null, 1)}</pre>
                  </details>
                )}
              </li>
            ))}
          </ul>
        )}
      </Carte>
      <div className="mt-3 flex justify-between text-sm">
        {page > 1 ? <Link href={`/journal?page=${page - 1}${entite ? `&entite=${entite}` : ""}`} className="btn-ghost btn-sm">‹ Plus récent</Link> : <span />}
        {rows.length === PAR_PAGE && <Link href={`/journal?page=${page + 1}${entite ? `&entite=${entite}` : ""}`} className="btn-ghost btn-sm">Plus ancien ›</Link>}
      </div>
    </>
  );
}
