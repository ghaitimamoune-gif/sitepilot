import Link from "next/link";
import { NavBas, type ElementNav } from "@/components/NavBas";
import { SignalerProbleme } from "@/components/SignalerProbleme";
import { aLeDroit, type Role } from "@/lib/auth/droits";
import { exigerSession, type Session } from "@/lib/auth/session";
import { compterAlertesOuvertes } from "@/lib/services/alertes";
import { tickEnArrierePlan } from "@/lib/services/jobs";
import { compterRemontees } from "@/lib/services/taches";

export const dynamic = "force-dynamic";

function elementsNav(s: Session, alertes: number, remontees: number): ElementNav[] {
  const role: Role = s.poste.role;
  const plus: ElementNav = { href: "/plus", libelle: "Plus", icone: "☰" };
  switch (role) {
    case "proprietaire":
      return [
        { href: "/pilotage", libelle: "Pilotage", icone: "◉", compteur: alertes },
        { href: "/previsionnel", libelle: "Prévisionnel", icone: "📈" },
        { href: "/commandes", libelle: "Commandes", icone: "🧾" },
        { href: "/stocks", libelle: "Stocks", icone: "📦" },
        { href: "/plus", libelle: "Plus", icone: "☰" },
      ];
    case "manager":
      return [
        { href: "/manager", libelle: "Accueil", icone: "◉", compteur: alertes + remontees },
        { href: "/taches", libelle: "Tâches", icone: "☑" },
        { href: "/receptions", libelle: "Réceptions", icone: "🚚" },
        { href: "/cloture", libelle: "Clôture", icone: "🌙" },
        plus,
      ];
    case "resp_achats":
      return [
        { href: "/commandes", libelle: "Commandes", icone: "🧾", compteur: alertes },
        { href: "/comptages", libelle: "Comptage", icone: "🔢" },
        { href: "/stocks", libelle: "Stocks", icone: "📦" },
        { href: "/taches", libelle: "Tâches", icone: "☑" },
        plus,
      ];
    case "resp_cuisine":
      return [
        { href: "/preparations", libelle: "Préparations", icone: "🍳" },
        { href: "/comptages", libelle: "Comptage", icone: "🔢" },
        { href: "/equipe", libelle: "Équipe", icone: "👥", compteur: remontees },
        { href: "/taches", libelle: "Tâches", icone: "☑" },
        plus,
      ];
    case "resp_salle":
      return [
        { href: "/taches", libelle: "Tâches", icone: "☑" },
        { href: "/equipe", libelle: "Équipe", icone: "👥", compteur: remontees },
        { href: "/stocks", libelle: "Ruptures", icone: "⚠" },
        plus,
      ];
    default:
      return [
        { href: "/taches", libelle: "Tâches", icone: "☑" },
        ...(s.poste.voitPreparations ? [{ href: "/preparations", libelle: "Préparations", icone: "🍳" }] : []),
        plus,
      ];
  }
}

export default async function LayoutApp({ children }: { children: React.ReactNode }) {
  const s = await exigerSession();
  tickEnArrierePlan();
  const [alertes, remontees] = await Promise.all([
    aLeDroit(s.poste.role, "alertes:lire") ? compterAlertesOuvertes({ role: s.poste.role, posteId: s.poste.id }) : Promise.resolve({ total: 0, critiques: 0 }),
    ["manager", "resp_cuisine", "resp_salle"].includes(s.poste.role) ? compterRemontees(s.poste.role) : Promise.resolve(0),
  ]);
  const nav = elementsNav(s, alertes.total, remontees);
  // Mode test : bandeau et bouton « Signaler un problème » (jamais en production).
  const modeTest = process.env.MODE_DEMO === "1";
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col">
      <header className="sticky top-0 z-30 flex items-center justify-between gap-2 border-b border-line bg-bg/95 px-4 py-2 backdrop-blur">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand text-sm font-bold text-white display">EB</span>
          <span className="display text-lg font-semibold leading-none">Ops</span>
        </Link>
        <div className="flex min-w-0 items-center gap-2">
          <Link href="/plus" className="min-w-0 truncate text-right text-sm">
            <span className="font-semibold">{s.personne.prenom}</span>
            <span className="block truncate text-xs text-muted">{s.poste.nom}</span>
          </Link>
          {modeTest && <SignalerProbleme />}
        </div>
      </header>
      {modeTest && (
        <p className="bg-amber-100 px-4 py-1 text-center text-xs font-medium text-amber-900 dark:bg-amber-900/50 dark:text-amber-100">
          Version de test — données de démonstration. 💬 pour signaler un problème.
        </p>
      )}
      <main className="flex-1 px-4 pb-24 pt-4">{children}</main>
      <NavBas elements={nav} />
    </div>
  );
}
