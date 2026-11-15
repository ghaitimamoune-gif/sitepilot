"use client";

import { actionCreerReception } from "@/app/actions/receptions";
import { BoutonAction } from "@/components/ui/BoutonAction";
import { Badge } from "@/components/ui/primitives";

export interface FournisseurChoix {
  id: number;
  nom: string;
  statut: string;
  achatDirect: boolean;
  attendue: { commandeId: number; dateLivraison: string } | null;
}

/** Les fournisseurs dont une commande est attendue viennent en tête, puis les autres. */
export function ChoixFournisseur({ fournisseurs }: { fournisseurs: FournisseurChoix[] }) {
  return (
    <ul className="flex flex-col gap-2">
      {fournisseurs.map((f) => (
        <li key={f.id}>
          <BoutonAction className={`w-full justify-between ${f.attendue ? "btn-brand" : "btn-ghost"}`} action={() => actionCreerReception(f.id, f.achatDirect)}>
            <span className="text-left">
              {f.nom}
              {f.attendue && <span className="block text-xs font-normal opacity-90">commande n° {f.attendue.commandeId} attendue le {f.attendue.dateLivraison}</span>}
              {f.achatDirect && <span className="block text-xs font-normal opacity-80">achat de dépannage payé en espèces</span>}
            </span>
            {f.statut === "a_verifier" && <Badge teinte="orange">à vérifier</Badge>}
          </BoutonAction>
        </li>
      ))}
    </ul>
  );
}
