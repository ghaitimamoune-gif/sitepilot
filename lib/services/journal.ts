import { db, schema, type Tx } from "@/lib/db";

export interface Acteur {
  posteId: number | null;
  personneId: number | null;
}

/** Journal d'audit : rien ne se supprime, chaque action est tracée avec son auteur. */
export async function journaliser(
  acteur: Acteur | null,
  entite: string,
  action: string,
  options: { entiteId?: number | null; avant?: unknown; apres?: unknown; tx?: Tx } = {},
): Promise<void> {
  const ex = options.tx ?? db;
  await ex.insert(schema.journal).values({
    posteId: acteur?.posteId ?? null,
    personneId: acteur?.personneId ?? null,
    entite,
    entiteId: options.entiteId ?? null,
    action,
    avant: options.avant === undefined ? null : options.avant,
    apres: options.apres === undefined ? null : options.apres,
  });
}
