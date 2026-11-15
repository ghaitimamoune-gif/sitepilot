import Link from "next/link";
import { Badge, Carte, EnTete, Ligne } from "@/components/ui/primitives";
import { aLeDroit } from "@/lib/auth/droits";
import { exigerDroit } from "@/lib/auth/session";
import { listerFournisseurs } from "@/lib/services/commandes";

const JOURS = ["dim", "lun", "mar", "mer", "jeu", "ven", "sam"];

export default async function PageFournisseurs() {
  const s = await exigerDroit("fournisseurs:creer");
  const fournisseurs = await listerFournisseurs(true);
  const peutCompleter = aLeDroit(s.poste.role, "fournisseurs:completer");
  return (
    <>
      <EnTete
        titre="Fournisseurs"
        sousTitre="Chaque fournisseur porte ses jours de livraison et son heure limite de commande."
        action={
          <div className="flex gap-1">
            <Link href="/fournisseurs/nouveau?retour=/fournisseurs" className="btn-ghost btn-sm">+ Rapide</Link>
            {peutCompleter && <Link href="/fournisseurs/0" className="btn-brand btn-sm">+ Fiche</Link>}
          </div>
        }
      />
      <Carte className="divide-rows p-0 px-3">
        {fournisseurs.map((f) => (
          <Ligne
            key={f.id}
            href={`/fournisseurs/${f.id}`}
            gauche={
              <>
                <span className={`font-medium ${f.statut === "archive" ? "text-muted line-through" : ""}`}>
                  {f.nom} {f.statut === "a_verifier" && <Badge teinte="orange">à vérifier</Badge>} {f.validationRequise && <Badge teinte="bleu">validation</Badge>} {f.achatDirect && <Badge teinte="neutre">achat direct</Badge>}
                </span>
                <span className="block text-xs text-muted">
                  {f.joursLivraison.length === 0 ? "tout jour ouvert" : f.joursLivraison.map((j) => JOURS[j]).join(" ")}
                  {f.heureLimite ? ` · avant ${f.heureLimite}` : ""}
                  {f.whatsapp ? ` · ${f.whatsapp}` : " · sans WhatsApp"}
                </span>
              </>
            }
            droite={<span className="text-muted">›</span>}
          />
        ))}
      </Carte>
    </>
  );
}
