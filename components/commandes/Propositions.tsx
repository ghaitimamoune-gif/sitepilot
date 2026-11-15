"use client";

import { actionGenererBrouillons } from "@/app/actions/commandes";
import { BoutonAction } from "@/components/ui/BoutonAction";

export function BoutonGenererBrouillons({ libelle = "Préparer les commandes du jour" }: { libelle?: string }) {
  return (
    <BoutonAction className="btn-brand w-full" action={() => actionGenererBrouillons()}>
      {libelle}
    </BoutonAction>
  );
}
