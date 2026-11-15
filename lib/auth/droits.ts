/**
 * Matrice des droits (section 3 du brief). Vérifiée côté serveur à chaque requête.
 * « ecrire » inclut la lecture.
 */
export type Role = "proprietaire" | "manager" | "resp_achats" | "resp_cuisine" | "resp_salle" | "employe";
export type Zone = "direction" | "cuisine" | "salle";

export const ROLES: Role[] = ["proprietaire", "manager", "resp_achats", "resp_cuisine", "resp_salle", "employe"];

export const LIBELLE_ROLE: Record<Role, string> = {
  proprietaire: "Propriétaire",
  manager: "Manager",
  resp_achats: "Responsable achats",
  resp_cuisine: "Responsable cuisine",
  resp_salle: "Responsable salle",
  employe: "Poste employé",
};

export type Droit =
  | "previsionnel:lire"
  | "previsionnel:ecrire"
  | "ca_realise:ecrire"
  | "preparations:lire"
  | "preparations:restes"
  | "preparations:forcer"
  | "prix:lire"
  | "prix:ecrire"
  | "comptage_cuisine:ecrire"
  | "comptage_cuisine:lire"
  | "comptage_reserve:ecrire"
  | "comptage_reserve:lire"
  | "commandes:lire"
  | "commandes:ecrire"
  | "commandes:valider"
  | "receptions:lire"
  | "receptions:ecrire"
  | "fournisseurs:creer"
  | "fournisseurs:completer"
  | "rupture:signaler"
  | "pertes:declarer"
  | "taches:cocher"
  | "taches:creer"
  | "taches:verifier"
  | "alertes:lire"
  | "parametres:lire"
  | "parametres:ecrire"
  | "activite:lire"
  | "comptes:encadrement"
  | "comptes:employes"
  | "cloture:ecrire"
  | "import:ventes"
  | "export:donnees"
  | "journal:lire";

const MATRICE: Record<Droit, Role[]> = {
  "previsionnel:lire": ["proprietaire", "manager", "resp_achats"],
  "previsionnel:ecrire": ["proprietaire"],
  "ca_realise:ecrire": ["proprietaire", "manager"],
  "preparations:lire": ["proprietaire", "manager", "resp_achats", "resp_cuisine", "employe"],
  "preparations:restes": ["resp_cuisine", "manager"],
  "preparations:forcer": ["manager"],
  "prix:lire": ["proprietaire", "manager", "resp_achats"],
  "prix:ecrire": ["proprietaire"],
  "comptage_cuisine:ecrire": ["resp_cuisine", "manager"],
  "comptage_cuisine:lire": ["proprietaire", "resp_cuisine", "manager"],
  "comptage_reserve:ecrire": ["resp_achats"],
  "comptage_reserve:lire": ["proprietaire", "resp_achats"],
  "commandes:lire": ["proprietaire", "manager", "resp_achats"],
  "commandes:ecrire": ["resp_achats"],
  "commandes:valider": ["proprietaire"],
  "receptions:lire": ["proprietaire", "manager", "resp_cuisine"],
  "receptions:ecrire": ["manager", "resp_cuisine"],
  "fournisseurs:creer": ["proprietaire", "manager", "resp_achats"],
  "fournisseurs:completer": ["proprietaire"],
  "rupture:signaler": ["proprietaire", "manager", "resp_achats", "resp_cuisine", "resp_salle"],
  "pertes:declarer": ["resp_cuisine", "manager"],
  "taches:cocher": ["proprietaire", "manager", "resp_achats", "resp_cuisine", "resp_salle", "employe"],
  "taches:creer": ["proprietaire", "manager", "resp_cuisine", "resp_salle"],
  "taches:verifier": ["manager", "resp_cuisine", "resp_salle"],
  "alertes:lire": ["proprietaire", "manager", "resp_achats", "resp_cuisine", "resp_salle"],
  "parametres:lire": ["proprietaire", "manager"],
  "parametres:ecrire": ["proprietaire"],
  "activite:lire": ["proprietaire", "manager"],
  "comptes:encadrement": ["proprietaire"],
  "comptes:employes": ["proprietaire", "manager"],
  "cloture:ecrire": ["proprietaire", "manager"],
  "import:ventes": ["proprietaire", "manager"],
  "export:donnees": ["proprietaire"],
  "journal:lire": ["proprietaire"],
};

export function aLeDroit(role: Role, droit: Droit): boolean {
  return MATRICE[droit].includes(role);
}

/** Les deux règles qui ne se négocient pas. */
export function interdictionsAbsolues(role: Role): string[] {
  const l: string[] = [];
  if (role === "resp_achats") l.push("La responsable achats ne réceptionne jamais.");
  if (role === "resp_cuisine") l.push("Le responsable cuisine ne modifie aucune quantité de préparation.");
  return l;
}

export interface PosteMinimal {
  id: number;
  role: Role;
  zone: Zone;
  posteSuperieurId: number | null;
}

/**
 * Un responsable peut créer ou vérifier des tâches pour les postes de son périmètre :
 * propriétaire → tout poste ; manager → tout poste sous elle ; responsable cuisine → postes de
 * cuisine ; responsable salle → postes de salle.
 */
export function dansPerimetre(acteur: PosteMinimal, cible: PosteMinimal): boolean {
  if (acteur.id === cible.id) return false;
  switch (acteur.role) {
    case "proprietaire":
      return true;
    case "manager":
      return cible.role !== "proprietaire" && cible.role !== "manager";
    case "resp_cuisine":
      return cible.role === "employe" && cible.zone === "cuisine";
    case "resp_salle":
      return cible.role === "employe" && cible.zone === "salle";
    default:
      return false;
  }
}

/** Rôle qui reçoit la remontée d'une tâche en retard, selon le poste qui la porte. */
export function roleRemontee(poste: PosteMinimal): Role | null {
  switch (poste.role) {
    case "employe":
      return poste.zone === "salle" ? "resp_salle" : "resp_cuisine";
    case "resp_cuisine":
    case "resp_salle":
    case "resp_achats":
      return "manager";
    case "manager":
      return "proprietaire";
    default:
      return null;
  }
}

/** Rôles destinataires des alertes, par périmètre. */
export function rolesAlertes(role: Role): string[] {
  switch (role) {
    case "proprietaire":
      return ["proprietaire"];
    case "manager":
      return ["manager"];
    case "resp_achats":
      return ["resp_achats"];
    case "resp_cuisine":
      return ["resp_cuisine"];
    case "resp_salle":
      return ["resp_salle"];
    default:
      return [];
  }
}

export function longueurPin(role: Role): number {
  return role === "proprietaire" ? 6 : 4;
}

/** Page d'accueil par rôle. */
export function accueilParRole(role: Role): string {
  switch (role) {
    case "proprietaire":
      return "/pilotage";
    case "manager":
      return "/manager";
    case "resp_achats":
      return "/commandes";
    case "resp_cuisine":
      return "/preparations";
    case "resp_salle":
      return "/taches";
    default:
      return "/taches";
  }
}
