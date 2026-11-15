import { Carte, EnTete } from "@/components/ui/primitives";

export default function PageAide() {
  return (
    <>
      <EnTete titre="Aide" retour="/plus" />
      <div className="flex flex-col gap-3 text-sm">
        <Carte titre="Connexion">
          <p>Le code PIN désigne le poste, le prénom dit qui agit. La session reste ouverte 12 heures sans activité. Cinq codes erronés bloquent le poste 5 minutes sur cet appareil.</p>
        </Carte>
        <Carte titre="Tâches">
          <p>« C&apos;est fait » ne s&apos;active que si la preuve demandée est complète (points cochés, photos, valeurs). « Bloquée » demande un motif et remonte aussitôt au responsable. Une tâche non faite à l&apos;heure cible plus le délai remonte d&apos;un niveau.</p>
        </Carte>
        <Carte titre="Comptages">
          <p>Le stock théorique n&apos;est pas affiché pendant le comptage : le chiffre saisi doit être réellement compté. Chaque ligne est enregistrée dès la saisie ; un comptage interrompu se reprend où il s&apos;est arrêté.</p>
        </Carte>
        <Carte titre="Commandes et réceptions">
          <p>Celui qui commande ne réceptionne jamais. Les quantités commandées ne s&apos;affichent qu&apos;après la validation de la réception. L&apos;envoi d&apos;une commande ouvre WhatsApp avec le message pré-rempli ; la commande ne passe « envoyée » qu&apos;après votre confirmation.</p>
        </Carte>
        <Carte titre="Réseau">
          <p>Une saisie non transmise est gardée sur le téléphone et renvoyée automatiquement. L&apos;écran indique « Non enregistré » tant que le serveur n&apos;a pas confirmé.</p>
        </Carte>
        <Carte titre="Installer sur l'écran d'accueil">
          <p>Android (Chrome) : menu ⋮ → « Ajouter à l&apos;écran d&apos;accueil ». iPhone (Safari) : bouton Partager → « Sur l&apos;écran d&apos;accueil ».</p>
        </Carte>
      </div>
    </>
  );
}
