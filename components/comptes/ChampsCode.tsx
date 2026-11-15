import { Champ } from "@/components/ui/primitives";

/** Saisie d'un nouveau code PIN, deux fois, au clavier numérique. */
export function ChampsCode({ longueur }: { longueur: 4 | 6 }) {
  const commun = {
    className: "input text-center text-2xl tracking-[0.5em]",
    inputMode: "numeric" as const,
    pattern: `[0-9]{${longueur}}`,
    minLength: longueur,
    maxLength: longueur,
    autoComplete: "new-password",
    required: true,
    type: "password",
  };
  return (
    <>
      <Champ label={`Choisissez votre code (${longueur} chiffres)`} aide="Personnel : ne le communiquez à personne. Évitez les suites (123456) et les chiffres répétés.">
        <input name="pin" {...commun} />
      </Champ>
      <Champ label="Confirmez le code">
        <input name="pin2" {...commun} />
      </Champ>
    </>
  );
}
