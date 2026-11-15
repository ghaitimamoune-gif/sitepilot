import Link from "next/link";
import { actionCreerInvitation, actionQrEnrolement } from "@/app/actions/invitations";
import { PartageLien } from "@/components/comptes/PartageLien";
import { Badge, Carte, EnTete, Message } from "@/components/ui/primitives";
import { pinDefini } from "@/lib/auth/crypto";
import { LIBELLE_ROLE } from "@/lib/auth/droits";
import { exigerDroit } from "@/lib/auth/session";
import { db, schema } from "@/lib/db";
import { fmtPct } from "@/lib/format";
import { listerPostes } from "@/lib/services/comptes";
import { derniersComptagesParFamille } from "@/lib/services/comptages";
import { chargerMoteur } from "@/lib/services/moteur";
import { chargerParametres, nombreDepuis } from "@/lib/services/parametres";
import { derniersPrix } from "@/lib/services/stock";
import { eq } from "drizzle-orm";

function Etape({ n, titre, fait, children }: { n: number; titre: string; fait: boolean; children: React.ReactNode }) {
  return (
    <Carte className={fait ? "opacity-80" : "border-brand/50"}>
      <div className="mb-2 flex items-start gap-3">
        <span className={`display flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-lg font-bold ${fait ? "bg-emerald-600 text-white" : "bg-brand text-white"}`}>{fait ? "✓" : n}</span>
        <h2 className="pt-1 text-base">{titre}</h2>
      </div>
      <div className="text-sm">{children}</div>
    </Carte>
  );
}

/** Mise en service guidée pour les propriétaires : comptes, téléphones, catalogue, réglages. */
export default async function PageMiseEnService() {
  await exigerDroit("comptes:encadrement");
  const [postes, { articles, familles }, prixMap, derniers, p, fournisseursAVerifier] = await Promise.all([
    listerPostes(false),
    chargerMoteur(),
    derniersPrix(),
    derniersComptagesParFamille(),
    chargerParametres(),
    db.select({ id: schema.fournisseurs.id }).from(schema.fournisseurs).where(eq(schema.fournisseurs.statut, "a_verifier")),
  ]);
  const associes = postes.filter((x) => x.role === "proprietaire");
  const encadrement = postes.filter((x) => x.role !== "proprietaire" && x.role !== "employe");
  const employes = postes.filter((x) => x.role === "employe");
  const sansPrix = [...articles.values()].filter((a) => a.statut !== "archive" && a.nature !== "preparation" && !prixMap.has(a.id));
  const famillesJamaisComptees = familles.filter((f) => !derniers.has(f.id));
  const ligne = (x: (typeof postes)[number]) => (
    <li key={x.id} className="flex items-center justify-between gap-2 py-1.5">
      <span>
        {x.nom}
        <span className="block text-xs text-muted">{LIBELLE_ROLE[x.role]}</span>
      </span>
      {pinDefini(x.pinHash) ? (
        <Badge teinte="vert">code choisi</Badge>
      ) : (
        <PartageLien creer={actionCreerInvitation.bind(null, x.id)} libelle="Inviter" className="btn-brand btn-sm" />
      )}
    </li>
  );
  return (
    <>
      <EnTete titre="Mise en service" sousTitre="Les étapes pour démarrer. Chaque invitation est un lien personnel, à usage unique, valable 72 heures." />
      <div className="flex flex-col gap-3">
        <Message type="info">Aucun identifiant n&apos;est partagé : chacun choisit son code en ouvrant son lien d&apos;invitation sur son propre téléphone.</Message>
        <Etape n={1} titre="Inviter vos associés" fait={associes.every((x) => pinDefini(x.pinHash))}>
          <ul className="divide-rows">{associes.map(ligne)}</ul>
        </Etape>
        <Etape n={2} titre="Inviter la manager et les responsables" fait={encadrement.every((x) => pinDefini(x.pinHash))}>
          <ul className="divide-rows">{encadrement.map(ligne)}</ul>
        </Etape>
        <Etape n={3} titre="Codes des postes employés" fait={employes.every((x) => pinDefini(x.pinHash))}>
          <p className="mb-2 text-muted">
            Un poste employé est partagé par tous ceux qui l&apos;occupent : la manager fixe son code à 4 chiffres (Comptes et postes) et le donne de vive voix. Pour un nouvel employé, elle lui fait scanner l&apos;invitation du poste : son téléphone est enregistré et il est connecté avec son prénom.
          </p>
          <p className="mb-2">
            {employes.filter((x) => pinDefini(x.pinHash)).length}/{employes.length} postes ont un code.{" "}
            <Link href="/comptes" className="lien font-medium text-brand">Comptes et postes</Link>
          </p>
        </Etape>
        <Etape n={4} titre="Enregistrer les téléphones" fait={false}>
          <p className="mb-2 text-muted">Pour un téléphone qui n&apos;a pas reçu d&apos;invitation : il scanne ce QR code (ou ouvre le lien), puis saisit le code de son poste.</p>
          <PartageLien creer={actionQrEnrolement} libelle="Afficher le QR code d'enrôlement" />
        </Etape>
        <Etape n={5} titre="Compléter les fournisseurs" fait={fournisseursAVerifier.length === 0}>
          <p className="mb-2 text-muted">Numéro WhatsApp, jours de livraison, heure limite, conditionnements, validation propriétaire.</p>
          <p>
            {fournisseursAVerifier.length} fiche{fournisseursAVerifier.length > 1 ? "s" : ""} à vérifier.{" "}
            <Link href="/fournisseurs" className="lien font-medium text-brand">Fournisseurs</Link>
          </p>
        </Etape>
        <Etape n={6} titre="Saisir les prix d'achat" fait={sansPrix.length === 0}>
          <p>
            {sansPrix.length} article{sansPrix.length > 1 ? "s" : ""} sans prix (écarts et coût matière valorisés au dernier prix).{" "}
            <Link href="/prix" className="lien font-medium text-brand">Prix d&apos;achat</Link>
          </p>
        </Etape>
        <Etape n={7} titre="Recopier les checklists du manuel" fait={false}>
          <p>
            Les points à cocher de départ sont provisoires : les remplacer mot pour mot par ceux des fiches 03.1 à 03.9.{" "}
            <Link href="/parametres/taches" className="lien font-medium text-brand">Modèles de tâches</Link>
          </p>
        </Etape>
        <Etape n={8} titre="Fixer la cible du coût matière" fait={false}>
          <p>
            Actuellement {fmtPct(nombreDepuis(p, "cout_matiere_cible"), 0)}.{" "}
            <Link href="/parametres" className="lien font-medium text-brand">Paramètres</Link>
          </p>
        </Etape>
        <Etape n={9} titre="Premier comptage complet" fait={famillesJamaisComptees.length === 0}>
          <p>
            Tant qu&apos;un article n&apos;a jamais été compté, son stock est inconnu et il n&apos;est pas proposé à la commande. {famillesJamaisComptees.length} famille
            {famillesJamaisComptees.length > 1 ? "s" : ""} jamais comptée{famillesJamaisComptees.length > 1 ? "s" : ""}.
          </p>
        </Etape>
      </div>
    </>
  );
}
