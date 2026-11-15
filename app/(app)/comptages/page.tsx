import Link from "next/link";
import { Badge, Carte, EnTete, Ligne, Vide } from "@/components/ui/primitives";
import { aLeDroit } from "@/lib/auth/droits";
import { exigerSession } from "@/lib/auth/session";
import { dateCourte, instantCourt, joursEntre, journeeExploitation } from "@/lib/dates";
import { comptagesEnCours, derniersComptagesParFamille, historiqueComptages } from "@/lib/services/comptages";
import { chargerMoteur } from "@/lib/services/moteur";

const LIBELLE_RYTHME = { quotidien: "chaque jour ouvert", hebdomadaire: "chaque semaine", mensuel: "chaque mois" } as const;

export default async function PageComptages() {
  const s = await exigerSession();
  const peutCuisine = aLeDroit(s.poste.role, "comptage_cuisine:ecrire");
  const peutReserve = aLeDroit(s.poste.role, "comptage_reserve:ecrire");
  const lit = aLeDroit(s.poste.role, "comptage_cuisine:lire") || aLeDroit(s.poste.role, "comptage_reserve:lire");
  if (!peutCuisine && !peutReserve && !lit) {
    return <Vide>Votre poste ne compte pas de stock.</Vide>;
  }
  const { familles } = await chargerMoteur();
  const [derniers, enCours, historique] = await Promise.all([derniersComptagesParFamille(), comptagesEnCours(s.poste.id), historiqueComptages(15)]);
  const aujourdHui = journeeExploitation();
  const mesFamilles = familles.filter((f) => (f.roleCompteur === "resp_cuisine" ? peutCuisine : peutReserve));
  const autres = familles.filter((f) => !mesFamilles.includes(f));
  const estDu = (f: (typeof familles)[number]) => {
    const d = derniers.get(f.id);
    if (!d) return true;
    const age = joursEntre(d, aujourdHui);
    return f.rythme === "quotidien" ? age >= 1 : f.rythme === "hebdomadaire" ? age >= 7 : age >= 28;
  };
  return (
    <>
      <EnTete titre="Comptages" sousTitre="Chaque famille a son rythme et son responsable." />
      <div className="flex flex-col gap-4">
        {enCours.length > 0 && (
          <Carte titre="À reprendre">
            {enCours.map((c) => (
              <Ligne key={c.id} href={`/comptages/${c.id}`} gauche={<span className="font-medium">{familles.find((f) => f.id === c.familleId)?.nom}{c.fermeture ? " — fermeture" : ""}</span>} droite={<Badge teinte="orange">en cours</Badge>} />
            ))}
          </Carte>
        )}
        {mesFamilles.length > 0 && (
          <Carte titre="Mes familles" className="divide-rows p-0 px-4 py-1">
            {mesFamilles.map((f) => {
              const d = derniers.get(f.id);
              const du = estDu(f);
              return (
                <Ligne
                  key={f.id}
                  href={`/comptages/famille/${f.id}`}
                  gauche={
                    <>
                      <span className="font-medium">{f.nom}</span>
                      <span className="block text-xs text-muted">
                        {LIBELLE_RYTHME[f.rythme]} · dernier : {d ? dateCourte(d) : "jamais"}
                      </span>
                    </>
                  }
                  droite={du ? <Badge teinte="brand">à faire</Badge> : <span className="text-muted">›</span>}
                />
              );
            })}
          </Carte>
        )}
        {peutCuisine && (
          <Link href={`/comptages/famille/${familles.find((f) => f.rythme === "quotidien")?.id ?? ""}?fermeture=1`} className="btn-ghost w-full">
            Comptage de fermeture des produits critiques
          </Link>
        )}
        {autres.length > 0 && lit && (
          <Carte titre="Autres familles" className="divide-rows p-0 px-4 py-1">
            {autres.map((f) => (
              <Ligne key={f.id} gauche={<span>{f.nom}</span>} droite={<span className="text-xs text-muted">{derniers.get(f.id) ? dateCourte(derniers.get(f.id)!) : "jamais"}</span>} />
            ))}
          </Carte>
        )}
        <Carte titre="Historique">
          {historique.length === 0 ? (
            <Vide>Aucun comptage.</Vide>
          ) : (
            <ul className="divide-rows">
              {historique.map((h) => (
                <li key={h.c.id}>
                  <Ligne
                    href={`/comptages/${h.c.id}`}
                    gauche={
                      <>
                        <span className="font-medium">{h.famille}{h.c.fermeture ? " — fermeture" : ""}</span>
                        <span className="block text-xs text-muted">
                          {dateCourte(h.c.date)} · {h.prenom ?? "—"}
                          {h.c.valideLe ? ` · validé ${instantCourt(h.c.valideLe)}` : ""}
                        </span>
                      </>
                    }
                    droite={<Badge teinte={h.c.statut === "valide" ? "vert" : "orange"}>{h.c.statut === "valide" ? "validé" : "en cours"}</Badge>}
                  />
                </li>
              ))}
            </ul>
          )}
        </Carte>
      </div>
    </>
  );
}
