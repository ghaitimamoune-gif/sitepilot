import { eq } from "drizzle-orm";
import { cache } from "react";
import { db, schema } from "@/lib/db";
import { journaliser, type Acteur } from "./journal";

/**
 * Paramètres du métier. Chaque valeur chiffrée du brief vit ici, jamais dans le code.
 * Les valeurs par défaut servent au premier démarrage ; le script de données initiales les écrit en base.
 */
export const PARAMETRES_DEFAUT = {
  marge_generale: { valeur: "0.10", libelle: "Marge de sécurité générale (0,10 = 10 %)" },
  seuil_dlc_veille_fermeture: { valeur: "2", libelle: "DLC (jours) sous laquelle on ne prend pas d'avance la veille d'une fermeture" },
  ca_defaut_semaine: { valeur: "18760", libelle: "CA de départ un jour de semaine (DH)" },
  ca_defaut_weekend: { valeur: "28315", libelle: "CA de départ un jour de week-end (DH)" },
  historique_ca_occurrences: { valeur: "4", libelle: "Occurrences du même jour pour estimer le CA (médiane)" },
  seuil_ecart_ca: { valeur: "0.05", libelle: "Écart prévu/réalisé mis en évidence (0,05 = 5 %)" },
  seuil_variation_coefficient: { valeur: "0.20", libelle: "Variation d'un coefficient soumise aux propriétaires" },
  semaines_glissantes_coefficients: { valeur: "4", libelle: "Semaines glissantes pour recalculer les coefficients" },
  seuil_ecart_stock_structurant: { valeur: "0.03", libelle: "Écart de stock d'un article structurant qui alerte (ventes importées)" },
  seuil_ecart_stock_estime: { valeur: "0.10", libelle: "Écart de stock qui alerte quand la consommation est estimée depuis le CA" },
  seuil_hausse_prix: { valeur: "0.03", libelle: "Hausse de prix d'un article structurant qui alerte" },
  prix_a_reverifier_jours: { valeur: "30", libelle: "Âge d'un prix au-delà duquel il est « à revérifier » (jours)" },
  cout_matiere_cible: { valeur: "0.30", libelle: "Cible du coût matière (part du CA)" },
  cout_matiere_alerte_points: { valeur: "0.02", libelle: "Points au-dessus de la cible : avertissement" },
  cout_matiere_critique_points: { valeur: "0.04", libelle: "Points au-dessus de la cible : critique" },
  heure_limite_reception: { valeur: "12:00", libelle: "Heure à laquelle une livraison attendue non saisie alerte" },
  comptage_hebdo_jour: { valeur: "3", libelle: "Jour du comptage hebdomadaire (0 = dimanche, 3 = mercredi)" },
  comptage_hebdo_heure: { valeur: "15:45", libelle: "Heure du comptage hebdomadaire" },
  comptage_quotidien_heure: { valeur: "08:45", libelle: "Heure du comptage quotidien de la cuisine" },
  jours_fermeture_hebdo: { valeur: "1", libelle: "Jours de fermeture hebdomadaire (0 = dimanche ... 6 = samedi), séparés par des virgules" },
  jours_weekend: { valeur: "6,0", libelle: "Jours de type « week-end »" },
  delai_remontee_defaut: { valeur: "30", libelle: "Délai de remontée par défaut d'une tâche (minutes)" },
  session_duree_heures: { valeur: "12", libelle: "Inactivité après laquelle la session se ferme (heures)" },
  pin_tentatives_max: { valeur: "5", libelle: "Codes erronés avant verrouillage" },
  pin_verrouillage_minutes: { valeur: "5", libelle: "Durée du verrouillage (minutes)" },
  photos_max: { valeur: "6", libelle: "Photos maximum par tâche" },
  photo_grand_cote: { valeur: "1600", libelle: "Grand côté des photos après compression (pixels)" },
  retention_photos_mois: { valeur: "3", libelle: "Conservation des photos (mois)" },
  retention_temperatures_mois: { valeur: "12", libelle: "Conservation des relevés de température (mois)" },
  code_enrolement: { valeur: "", libelle: "Code d'enrôlement des appareils" },
  modele_message_commande: {
    valeur:
      "Bonjour {contact},\nCommande Easy Burger pour livraison {jour} {date}, le matin avant le service :\n{lignes}\nMerci de confirmer la livraison.\n{prenom}, Easy Burger",
    libelle: "Modèle du message WhatsApp de commande",
  },
  nom_restaurant: { valeur: "Easy Burger", libelle: "Nom du restaurant" },
  installation_terminee: { valeur: "non", libelle: "Installation terminée (premier propriétaire inscrit)" },
} as const;

export type CleParametre = keyof typeof PARAMETRES_DEFAUT;

export const chargerParametres = cache(async (): Promise<Record<string, string>> => {
  const lignes = await db.select().from(schema.parametres);
  const res: Record<string, string> = {};
  for (const [k, v] of Object.entries(PARAMETRES_DEFAUT)) res[k] = v.valeur;
  for (const l of lignes) res[l.cle] = l.valeur;
  return res;
});

export async function parametre(cle: CleParametre): Promise<string> {
  const p = await chargerParametres();
  return p[cle] ?? PARAMETRES_DEFAUT[cle].valeur;
}

export async function parametreNombre(cle: CleParametre): Promise<number> {
  const v = Number((await parametre(cle)).replace(",", "."));
  return Number.isFinite(v) ? v : Number(PARAMETRES_DEFAUT[cle].valeur);
}

export function nombreDepuis(p: Record<string, string>, cle: CleParametre): number {
  const v = Number((p[cle] ?? PARAMETRES_DEFAUT[cle].valeur).replace(",", "."));
  return Number.isFinite(v) ? v : Number(PARAMETRES_DEFAUT[cle].valeur);
}

export function listeEntiers(p: Record<string, string>, cle: CleParametre): number[] {
  return (p[cle] ?? PARAMETRES_DEFAUT[cle].valeur)
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isInteger(n));
}

export async function ecrireParametre(acteur: Acteur, cle: string, valeur: string, auteur: string): Promise<void> {
  const [ancien] = await db.select().from(schema.parametres).where(eq(schema.parametres.cle, cle));
  const libelle = (PARAMETRES_DEFAUT as Record<string, { libelle: string }>)[cle]?.libelle ?? null;
  await db
    .insert(schema.parametres)
    .values({ cle, valeur, libelle, modifiePar: auteur, modifieLe: new Date() })
    .onConflictDoUpdate({
      target: schema.parametres.cle,
      set: { valeur, modifiePar: auteur, modifieLe: new Date() },
    });
  await journaliser(acteur, "parametre", "modifier", {
    avant: { cle, valeur: ancien?.valeur ?? null },
    apres: { cle, valeur },
  });
}
