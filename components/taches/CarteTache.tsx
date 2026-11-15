import Link from "next/link";
import { Badge, type Teinte } from "@/components/ui/primitives";
import { heureLocale } from "@/lib/dates";
import { LIBELLE_STATUT, type StatutTache } from "@/lib/services/taches";

export const TEINTE_STATUT: Record<StatutTache, Teinte> = {
  a_faire: "neutre",
  faite: "vert",
  verifiee: "vert",
  a_refaire: "orange",
  bloquee: "rouge",
  en_retard: "rouge",
  non_faite: "rouge",
  annulee: "neutre",
};

export interface TacheCarte {
  id: number;
  titre: string;
  echeance: Date;
  statut: StatutTache;
  preuve: "aucune" | "photos" | "valeurs";
  photosMin: number;
  structurante: boolean;
  ponctuelle: boolean;
  ecranLie: string | null;
  motifBlocage: string | null;
  commentaireVerif: string | null;
  points: string[];
  pointsCoches: boolean[];
}

export function CarteTache({ t, poste, href }: { t: TacheCarte; poste?: string; href?: string }) {
  const faite = t.statut === "faite" || t.statut === "verifiee";
  const enRetard = !faite && t.statut !== "annulee" && t.statut !== "non_faite" && t.echeance.getTime() < Date.now();
  const coches = t.pointsCoches.filter(Boolean).length;
  return (
    <Link href={href ?? `/taches/${t.id}`} className={`card flex items-center gap-3 p-3 ${faite ? "opacity-70" : ""} ${t.statut === "bloquee" || t.statut === "en_retard" ? "border-red-300" : ""}`}>
      <div className="display w-14 shrink-0 text-center">
        <span className={`block text-xl font-bold leading-none ${enRetard ? "text-red-600" : ""}`}>{heureLocale(t.echeance)}</span>
        {t.structurante && <span className="mt-0.5 block text-[10px] font-semibold uppercase text-brand">structurante</span>}
      </div>
      <div className="min-w-0 flex-1">
        <p className={`font-semibold leading-snug ${faite ? "line-through" : ""}`}>{t.titre}</p>
        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted">
          {poste && <span>{poste}</span>}
          {t.points.length > 0 && <span>{coches}/{t.points.length} points</span>}
          {t.preuve === "photos" && <span>{t.photosMin} photo{t.photosMin > 1 ? "s" : ""} min.</span>}
          {t.preuve === "valeurs" && <span>valeurs à saisir</span>}
          {t.ecranLie && <span>écran lié</span>}
          {t.ponctuelle && <span>ponctuelle</span>}
        </div>
        {t.motifBlocage && t.statut === "bloquee" && <p className="mt-1 text-xs text-red-700">Bloquée : {t.motifBlocage}</p>}
        {t.commentaireVerif && t.statut === "a_refaire" && <p className="mt-1 text-xs text-amber-700">À refaire : {t.commentaireVerif}</p>}
      </div>
      <Badge teinte={TEINTE_STATUT[t.statut]} className="shrink-0">
        {LIBELLE_STATUT[t.statut]}
      </Badge>
    </Link>
  );
}
