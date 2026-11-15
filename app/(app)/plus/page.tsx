import Link from "next/link";
import { actionSortir } from "@/app/actions/auth";
import { BasculeTheme } from "@/components/ui/Theme";
import { Carte, EnTete, Ligne } from "@/components/ui/primitives";
import { aLeDroit, LIBELLE_ROLE, type Droit } from "@/lib/auth/droits";
import { exigerSession } from "@/lib/auth/session";
import { compterAlertesOuvertes } from "@/lib/services/alertes";

interface Entree {
  href: string;
  libelle: string;
  detail?: string;
  droit?: Droit;
}

const ENTREES: { titre: string; entrees: Entree[] }[] = [
  {
    titre: "Exploitation",
    entrees: [
      { href: "/alertes", libelle: "Alertes", droit: "alertes:lire" },
      { href: "/taches", libelle: "Mes tâches" },
      { href: "/equipe", libelle: "Tâches de l'équipe", droit: "taches:verifier" },
      { href: "/taches/nouvelle", libelle: "Ajouter une tâche", droit: "taches:creer" },
      { href: "/preparations", libelle: "Fiche des préparations", droit: "preparations:lire" },
      { href: "/comptages", libelle: "Comptages", droit: "comptage_cuisine:lire" },
      { href: "/comptages", libelle: "Comptage de la réserve", droit: "comptage_reserve:ecrire" },
      { href: "/pertes", libelle: "Déclarer une perte", droit: "pertes:declarer" },
      { href: "/stocks", libelle: "Stocks et ruptures", droit: "rupture:signaler" },
    ],
  },
  {
    titre: "Achats",
    entrees: [
      { href: "/commandes", libelle: "Commandes fournisseurs", droit: "commandes:lire" },
      { href: "/receptions", libelle: "Réceptions", droit: "receptions:lire" },
      { href: "/fournisseurs", libelle: "Fournisseurs et articles", droit: "fournisseurs:creer" },
      { href: "/prix", libelle: "Prix d'achat", droit: "prix:lire" },
    ],
  },
  {
    titre: "Pilotage",
    entrees: [
      { href: "/pilotage", libelle: "Tableau de bord", droit: "previsionnel:ecrire" },
      { href: "/previsionnel", libelle: "Prévisionnel de CA", droit: "previsionnel:lire" },
      { href: "/cloture", libelle: "Clôture de journée", droit: "cloture:ecrire" },
      { href: "/import", libelle: "Importer les ventes de la caisse", droit: "import:ventes" },
      { href: "/activite", libelle: "Activité par personne", droit: "activite:lire" },
      { href: "/exports", libelle: "Exports (CSV)", droit: "export:donnees" },
      { href: "/journal", libelle: "Journal complet", droit: "journal:lire" },
    ],
  },
  {
    titre: "Administration",
    entrees: [
      { href: "/comptes", libelle: "Comptes et postes", droit: "comptes:employes" },
      { href: "/parametres", libelle: "Paramètres du moteur et seuils", droit: "parametres:lire" },
      { href: "/parametres/produits", libelle: "Produits, coefficients, nomenclature", droit: "parametres:lire" },
      { href: "/parametres/articles", libelle: "Articles et familles", droit: "parametres:lire" },
      { href: "/parametres/taches", libelle: "Modèles de tâches", droit: "parametres:lire" },
      { href: "/parametres/calendrier", libelle: "Calendrier et fermetures", droit: "parametres:lire" },
    ],
  },
];

export default async function PagePlus() {
  const s = await exigerSession();
  const alertes = aLeDroit(s.poste.role, "alertes:lire") ? await compterAlertesOuvertes({ role: s.poste.role, posteId: s.poste.id }) : null;
  return (
    <>
      <EnTete titre={s.personne.prenom} sousTitre={`${s.poste.nom} · ${LIBELLE_ROLE[s.poste.role]}`} />
      <div className="flex flex-col gap-4">
        {ENTREES.map((g) => {
          const visibles = g.entrees.filter((e) => !e.droit || aLeDroit(s.poste.role, e.droit));
          const uniques = visibles.filter((e, i) => visibles.findIndex((x) => x.href === e.href) === i);
          if (uniques.length === 0) return null;
          return (
            <Carte key={g.titre} titre={g.titre} className="divide-rows p-0 px-4 py-1">
              {uniques.map((e) => (
                <Ligne
                  key={e.href + e.libelle}
                  href={e.href}
                  gauche={<span className="font-medium">{e.libelle}</span>}
                  droite={e.href === "/alertes" && alertes && alertes.total > 0 ? <span className="badge bg-brand text-white">{alertes.total}</span> : <span className="text-muted">›</span>}
                />
              ))}
            </Carte>
          );
        })}
        <Carte titre="Affichage">
          <BasculeTheme />
        </Carte>
        <form action={actionSortir}>
          <button type="submit" className="btn-ghost w-full">
            Sortir
          </button>
        </form>
        <p className="text-center text-xs text-muted">
          Easy Burger Ops · <Link href="/plus/aide" className="lien underline">Aide</Link>
        </p>
      </div>
    </>
  );
}
