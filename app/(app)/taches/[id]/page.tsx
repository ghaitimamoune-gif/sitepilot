import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { DetailTache } from "@/components/taches/DetailTache";
import { VerifierTache } from "@/components/taches/VerifierTache";
import { Badge, EnTete } from "@/components/ui/primitives";
import { dansPerimetre } from "@/lib/auth/droits";
import { exigerSession } from "@/lib/auth/session";
import { db, schema } from "@/lib/db";
import { dateLongue, heureLocale, instantCourt } from "@/lib/dates";
import { chargerParametres, nombreDepuis } from "@/lib/services/parametres";
import { photosDe } from "@/lib/services/photos";
import { LIBELLE_STATUT, tache as chargerTache } from "@/lib/services/taches";
import { TEINTE_STATUT } from "@/components/taches/CarteTache";

export default async function PageTache({ params }: { params: Promise<{ id: string }> }) {
  const s = await exigerSession();
  const { id } = await params;
  const t = await chargerTache(Number(id));
  if (!t) notFound();
  const [poste] = await db.select().from(schema.postes).where(eq(schema.postes.id, t.posteId));
  const estLeMien = t.posteId === s.poste.id;
  const dansMonPerimetre = poste ? dansPerimetre(s.poste, { id: poste.id, role: poste.role, zone: poste.zone, posteSuperieurId: poste.posteSuperieurId }) : false;
  const estProprietaire = s.poste.role === "proprietaire";
  if (!estLeMien && !dansMonPerimetre && !estProprietaire && s.poste.role !== "manager") notFound();
  const [photos, p, faitePar, creePar] = await Promise.all([
    photosDe("tache", t.id),
    chargerParametres(),
    t.faiteParPersonneId ? db.select().from(schema.personnes).where(eq(schema.personnes.id, t.faiteParPersonneId)) : Promise.resolve([]),
    t.creeParPersonneId ? db.select().from(schema.personnes).where(eq(schema.personnes.id, t.creeParPersonneId)) : Promise.resolve([]),
  ]);
  const photosPrenoms = new Map<number, string>();
  for (const ph of photos) {
    if (ph.personneId && !photosPrenoms.has(ph.personneId)) {
      const [pers] = await db.select({ prenom: schema.personnes.prenom }).from(schema.personnes).where(eq(schema.personnes.id, ph.personneId));
      if (pers) photosPrenoms.set(ph.personneId, pers.prenom);
    }
  }
  return (
    <>
      <EnTete
        titre={t.titre}
        retour={estLeMien ? "/taches" : "/equipe"}
        sousTitre={
          <>
            {poste?.nom} · {dateLongue(t.journee)} à {heureLocale(t.echeance)} · <Badge teinte={TEINTE_STATUT[t.statut]}>{LIBELLE_STATUT[t.statut]}</Badge>
            {t.structurante && <> · <Badge teinte="brand">structurante</Badge></>}
          </>
        }
      />
      <div className="mb-3 text-xs text-muted">
        {creePar[0] && <p>Créée par {creePar[0].prenom}.</p>}
        {t.faiteLe && faitePar[0] && <p>Faite par {faitePar[0].prenom} le {instantCourt(t.faiteLe)}.</p>}
        {t.verifieeLe && <p>Vérifiée le {instantCourt(t.verifieeLe)}{t.commentaireVerif ? ` — ${t.commentaireVerif}` : ""}.</p>}
        {t.motifBlocage && <p className="text-red-700">Bloquée : {t.motifBlocage}</p>}
      </div>
      <DetailTache
        tache={{
          id: t.id,
          titre: t.titre,
          consigne: t.consigne,
          statut: t.statut,
          points: t.points,
          pointsCoches: t.pointsCoches,
          preuve: t.preuve,
          photosMin: t.photosMin,
          valeurs: t.valeurs,
          valeursSaisies: t.valeursSaisies,
          ecranLie: t.ecranLie,
          familleId: t.familleId,
          structurante: t.structurante,
        }}
        photos={photos.map((ph) => ({ id: ph.id, priseLe: ph.priseLe.toISOString(), prenom: ph.personneId ? photosPrenoms.get(ph.personneId) ?? null : null }))}
        photosMax={nombreDepuis(p, "photos_max")}
        estLeMien={estLeMien}
      />
      {!estLeMien && (dansMonPerimetre || estProprietaire) && (
        <div className="mt-4">
          <VerifierTache tacheId={t.id} statut={t.statut} peutVerifier={dansMonPerimetre} peutAnnuler={t.ponctuelle && (estProprietaire || t.creeParPosteId === s.poste.id)} />
        </div>
      )}
      {t.reporteeDe && <p className="mt-3 text-xs text-muted">Tâche ponctuelle reportée depuis un jour précédent.</p>}
    </>
  );
}
