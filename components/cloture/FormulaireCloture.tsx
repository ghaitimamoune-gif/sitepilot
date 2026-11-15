"use client";

import { actionCloturer } from "@/app/actions/cloture";
import { ChampNombre } from "@/components/ui/ChampNombre";
import { Formulaire } from "@/components/ui/Formulaire";
import { Champ } from "@/components/ui/primitives";

export interface ValeursCloture {
  caRealise: number | null;
  caMidi: number | null;
  caSoir: number | null;
  couverts: number | null;
  especes: number | null;
  carte: number | null;
  manquant: number | null;
  faitMarquant: string | null;
  source: "saisie" | "import" | null;
}

export function FormulaireCloture({ date, valeurs }: { date: string; valeurs: ValeursCloture }) {
  const importe = valeurs.source === "import";
  return (
    <Formulaire action={actionCloturer} bouton={valeurs.caRealise !== null ? "Mettre à jour et recomposer le rapport" : "Clôturer la journée"} className="card">
      <input type="hidden" name="date" value={date} />
      <Champ label="CA réalisé (DH)" aide={importe ? "Fichier de caisse importé pour cette journée : le CA vient du fichier." : "Total obligatoire ; la répartition midi et soir est facultative."}>
        <ChampNombre name="caRealise" defaultValue={valeurs.caRealise} disabled={importe} required />
      </Champ>
      <div className="grid grid-cols-2 gap-2">
        <Champ label="Midi (DH)">
          <ChampNombre name="caMidi" defaultValue={valeurs.caMidi} />
        </Champ>
        <Champ label="Soir (DH)">
          <ChampNombre name="caSoir" defaultValue={valeurs.caSoir} />
        </Champ>
      </div>
      <Champ label="Nombre de couverts">
        <ChampNombre name="couverts" defaultValue={valeurs.couverts} decimales={false} />
      </Champ>
      <div className="grid grid-cols-3 gap-2">
        <Champ label="Espèces">
          <ChampNombre name="especes" defaultValue={valeurs.especes} />
        </Champ>
        <Champ label="Carte">
          <ChampNombre name="carte" defaultValue={valeurs.carte} />
        </Champ>
        <Champ label="Manquant">
          <ChampNombre name="manquant" defaultValue={valeurs.manquant} />
        </Champ>
      </div>
      <Champ label="Fait marquant du service">
        <textarea name="faitMarquant" className="input" rows={2} defaultValue={valeurs.faitMarquant ?? ""} />
      </Champ>
    </Formulaire>
  );
}
