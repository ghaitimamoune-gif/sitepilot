/**
 * Un prénom désigne une personne sur un poste. La comparaison ignore la casse,
 * les accents et les espaces : « Youssef » et « youssef » sont la même personne.
 */
export function normaliserPrenom(prenom: string): string {
  return prenom
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[\s\-'’.]/g, "")
    .trim();
}

/** Présentation : première lettre en capitale, espaces réduits. */
export function presenterPrenom(prenom: string): string {
  const t = prenom.trim().replace(/\s+/g, " ");
  if (!t) return "";
  return t
    .split(" ")
    .map((m) => m.charAt(0).toLocaleUpperCase("fr-FR") + m.slice(1))
    .join(" ");
}

export function prenomValide(prenom: string): boolean {
  const n = normaliserPrenom(prenom);
  return n.length >= 2 && n.length <= 30 && /^[a-z0-9]+$/.test(n);
}
