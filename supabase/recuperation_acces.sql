-- ============================================================
-- SITEPILOT — RÉCUPÉRATION D'ACCÈS
--
-- À exécuter dans : Supabase → SQL Editor.
-- L'éditeur SQL contourne la sécurité RLS : il voit tout.
--
-- Ce fichier ne s'exécute PAS d'un bloc. Chaque section est indépendante :
-- lancez d'abord le diagnostic, puis uniquement la réparation qui correspond.
--
-- Remplacez partout 'vous@exemple.com' par votre adresse.
-- ============================================================


-- ============================================================
-- 1. DIAGNOSTIC — à lancer en premier
-- ============================================================
-- Interprétation de la colonne `etat_connexion` :
--
--   'compte inexistant'        → aucun compte pour cette adresse.
--                                Créez-le via la page d'inscription.
--   'e-mail non confirmé'      → CAUSE LA PLUS FRÉQUENTE.
--                                Le mot de passe est bon, mais Supabase
--                                refuse la connexion. Voir section 2.
--   'connexion possible'       → l'authentification n'est pas en cause.
--                                Si l'application paraît vide, voir section 4.

SELECT
  u.id                AS user_id,
  u.email,
  u.created_at        AS compte_cree_le,
  u.last_sign_in_at   AS derniere_connexion,
  CASE
    WHEN u.email_confirmed_at IS NULL THEN 'e-mail non confirmé'
    ELSE 'connexion possible'
  END                 AS etat_connexion,
  p.id IS NOT NULL    AS profil_present,
  p.role              AS role_profil,
  (SELECT count(*) FROM public.projects       pr WHERE pr.owner_id = u.id) AS projets_possedes,
  (SELECT count(*) FROM public.project_members m WHERE m.user_id  = u.id) AS projets_membre
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE u.email = 'vous@exemple.com';

-- Si la requête ne renvoie AUCUNE ligne, le compte n'existe pas sous cette
-- adresse. Listez les comptes présents :
--   SELECT email, created_at, email_confirmed_at FROM auth.users ORDER BY created_at;


-- ============================================================
-- 2. E-MAIL NON CONFIRMÉ — confirmer manuellement
-- ============================================================
-- À n'utiliser que pour votre propre compte, lorsque l'e-mail de
-- confirmation n'arrive pas (filtre anti-spam, quota d'envoi de l'offre
-- gratuite atteint : 3 e-mails/heure par défaut).
--
-- L'application propose aussi un bouton « Renvoyer l'e-mail de
-- confirmation » sur la page de connexion — essayez-le d'abord.

UPDATE auth.users
SET email_confirmed_at = COALESCE(email_confirmed_at, now())
WHERE email = 'vous@exemple.com';

-- Pour désactiver durablement l'obligation de confirmation (déconseillé en
-- production, pratique en phase de test) :
--   Supabase → Authentication → Sign In / Providers → Email
--   → décocher « Confirm email »


-- ============================================================
-- 3. PROFIL ABSENT — le recréer
-- ============================================================
-- Nécessaire seulement si le diagnostic indique `profil_present = false`.
-- Cas typique : compte créé avant l'exécution de la migration 001, donc
-- avant que le déclencheur `on_auth_user_created` n'existe.

INSERT INTO public.profiles (id, email, full_name, role)
SELECT u.id, u.email,
       COALESCE(u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1)),
       'admin'
FROM auth.users u
WHERE u.email = 'vous@exemple.com'
ON CONFLICT (id) DO NOTHING;

-- Remarque : la colonne `profiles.role` n'est aujourd'hui lue nulle part
-- dans l'application. Les droits réels dépendent uniquement de
-- l'appartenance au projet (section 4).


-- ============================================================
-- 4. CONNEXION OK MAIS AUCUN PROJET VISIBLE
-- ============================================================
-- L'application cloisonne les données par projet : vous ne voyez que les
-- chantiers dont vous êtes propriétaire ou membre (politique RLS
-- `is_project_member`). Un compte valide mais rattaché à rien affiche un
-- tableau de bord vide — ce qui ressemble à une perte de droits.

-- 4a. Quels projets existent, et à qui appartiennent-ils ?
SELECT pr.id, pr.name, pr.owner_id, u.email AS proprietaire
FROM public.projects pr
LEFT JOIN auth.users u ON u.id = pr.owner_id
ORDER BY pr.created_at;

-- 4b. Se rattacher comme administrateur à TOUS les projets existants.
--     (Si le projet de démonstration a été créé avec l'identifiant
--      d'exemple 'VOTRE_USER_ID_ICI' non remplacé, il n'appartient à
--      personne : cette requête le récupère.)
INSERT INTO public.project_members (project_id, user_id, role)
SELECT pr.id, u.id, 'admin'
FROM public.projects pr
CROSS JOIN auth.users u
WHERE u.email = 'vous@exemple.com'
ON CONFLICT DO NOTHING;

-- 4c. Devenir aussi propriétaire des projets orphelins.
UPDATE public.projects
SET owner_id = (SELECT id FROM auth.users WHERE email = 'vous@exemple.com')
WHERE owner_id IS NULL
   OR owner_id NOT IN (SELECT id FROM auth.users);


-- ============================================================
-- 5. MOT DE PASSE OUBLIÉ
-- ============================================================
-- Ne modifiez pas le mot de passe en SQL : il est stocké chiffré et une
-- écriture directe casserait le compte.
--
-- Passez par : Supabase → Authentication → Users → votre compte
--              → menu « … » → Send password recovery / Reset password
