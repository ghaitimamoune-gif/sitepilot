-- ============================================================
-- SITEPILOT — SEED DÉMONSTRATION
-- Migration 003 : Données d'exemple
-- IMPORTANT : Remplacez USER_ID par votre UUID Supabase
-- (Supabase → Authentication → Users → copier l'UUID)
-- ============================================================

-- Remplacer cette valeur :
DO $$
DECLARE
  v_user_id UUID := 'VOTRE_USER_ID_ICI'; -- ← CHANGER ICI
  v_project_id UUID;
  v_iv1 UUID; v_iv2 UUID; v_iv3 UUID; v_iv4 UUID; v_iv5 UUID;
  v_plan1 UUID; v_plan2 UUID; v_plan3 UUID;
  v_obs1 UUID; v_obs2 UUID; v_obs3 UUID;
  v_cl1 UUID;
BEGIN

-- Projet
INSERT INTO public.projects (id, name, address, description, phase, start_date, end_date, progress, owner_id)
VALUES (
  uuid_generate_v4(),
  'Résidence Les Jardins de l''Atlas',
  'Boulevard Zerktouni, Casablanca',
  'Complexe résidentiel R+6 — 48 appartements, commerces RDC',
  'Second œuvre', '2024-06-01', '2025-06-30', 42, v_user_id
) RETURNING id INTO v_project_id;

-- Ajouter comme membre
INSERT INTO public.project_members (project_id, user_id, role)
VALUES (v_project_id, v_user_id, 'admin');

-- Intervenants
INSERT INTO public.intervenants (id, project_id, name, type, contact, color)
VALUES (uuid_generate_v4(), v_project_id, 'BMCE Construction', 'Entreprise générale', 'K. Benali', '#3D8EF0') RETURNING id INTO v_iv1;
INSERT INTO public.intervenants (id, project_id, name, type, contact, color)
VALUES (uuid_generate_v4(), v_project_id, 'Arc & Design', 'Architecte', 'S. Alaoui', '#8B5CF6') RETURNING id INTO v_iv2;
INSERT INTO public.intervenants (id, project_id, name, type, contact, color)
VALUES (uuid_generate_v4(), v_project_id, 'ElecPro Maroc', 'Sous-traitant', 'H. Amrani', '#2EC972') RETURNING id INTO v_iv3;
INSERT INTO public.intervenants (id, project_id, name, type, contact, color)
VALUES (uuid_generate_v4(), v_project_id, 'PlomberieAZ', 'Sous-traitant', 'Y. Tazi', '#F07040') RETURNING id INTO v_iv4;
INSERT INTO public.intervenants (id, project_id, name, type, contact, color)
VALUES (uuid_generate_v4(), v_project_id, 'Maître d''ouvrage SARL', 'Maître d''ouvrage', 'R. Amzil', '#F5A623') RETURNING id INTO v_iv5;

-- Plans
INSERT INTO public.plans (id, project_id, name, zone, version, file_size)
VALUES (uuid_generate_v4(), v_project_id, 'Plan RDC — Façade principale', 'RDC', 'v2.0', '4.2 MB') RETURNING id INTO v_plan1;
INSERT INTO public.plans (id, project_id, name, zone, version, file_size)
VALUES (uuid_generate_v4(), v_project_id, 'Plan R+2 — Distribution', 'R+2', 'v1.5', '3.8 MB') RETURNING id INTO v_plan2;
INSERT INTO public.plans (id, project_id, name, zone, version, file_size)
VALUES (uuid_generate_v4(), v_project_id, 'Plan Toiture — Vue générale', 'Toiture', 'v1.0', '2.1 MB') RETURNING id INTO v_plan3;

-- Observations
INSERT INTO public.observations (id, project_id, plan_id, title, description, priority, status, zone, pos_x, pos_y, intervenant_id, created_by_name)
VALUES (uuid_generate_v4(), v_project_id, v_plan1, 'Fissure mur porteur côté Est',
  'Fissure verticale de 2mm visible sur le mur porteur axe B-4. Nécessite expertise urgente.',
  'critical', 'open', 'RDC', 65, 40, v_iv1, 'Chef de projet') RETURNING id INTO v_obs1;

INSERT INTO public.observations (id, project_id, plan_id, title, description, priority, status, zone, pos_x, pos_y, intervenant_id, created_by_name)
VALUES (uuid_generate_v4(), v_project_id, v_plan2, 'Dalles carrelage non conformes R+2',
  'Carrelage lot B non conforme au plan — joints > 3mm, pose non alignée axe X.',
  'high', 'progress', 'R+2', 35, 55, v_iv1, 'Chef de projet') RETURNING id INTO v_obs2;

INSERT INTO public.observations (id, project_id, plan_id, title, description, priority, status, zone, pos_x, pos_y, intervenant_id, created_by_name)
VALUES (uuid_generate_v4(), v_project_id, v_plan2, 'Câblage électrique non conforme apt 204',
  'Section câble 2.5mm² utilisée au lieu de 4mm² pour circuit cuisine. Risque incendie.',
  'critical', 'open', 'R+2', 70, 30, v_iv3, 'Architecte') RETURNING id INTO v_obs3;

-- Obs history
INSERT INTO public.obs_history (observation_id, action, by_name) VALUES (v_obs1, 'Créée', 'Chef de projet');
INSERT INTO public.obs_history (observation_id, action, by_name) VALUES (v_obs1, 'Assignée à BMCE Construction', 'Chef de projet');
INSERT INTO public.obs_history (observation_id, action, by_name) VALUES (v_obs2, 'Créée', 'Chef de projet');
INSERT INTO public.obs_history (observation_id, action, by_name, note) VALUES (v_obs2, 'En cours', 'K. Benali', 'Remplacement démarré');

-- Obs comments
INSERT INTO public.obs_comments (observation_id, author_name, content) VALUES (v_obs1, 'K. Benali', 'Expertise programmée pour demain 8h.');
INSERT INTO public.obs_comments (observation_id, author_name, content) VALUES (v_obs1, 'Chef de projet', 'Confirmer avec le bureau d''études.');

-- Reserves
INSERT INTO public.reserves (project_id, title, description, status, priority, zone, intervenant_id)
VALUES (v_project_id, 'Garde-corps terrasse manquant',
  'Garde-corps acier inox non installé côté est — danger sécurité.', 'open', 'critical', 'Toiture', v_iv1);
INSERT INTO public.reserves (project_id, title, description, status, priority, zone, intervenant_id)
VALUES (v_project_id, 'Porte palière appartement 103 non conforme',
  'Porte 90cm installée au lieu de 100cm selon plan.', 'progress', 'high', 'RDC', v_iv1);
INSERT INTO public.reserves (project_id, title, description, status, priority, zone, intervenant_id)
VALUES (v_project_id, 'VMC cuisine appartement 201 absente',
  'VMC non installée — oubli de lot.', 'corrected', 'medium', 'R+2', v_iv3);

-- Tasks
INSERT INTO public.tasks (project_id, title, priority, status, assignee_id, due_date, obs_id)
VALUES (v_project_id, 'Expertise fissure mur porteur', 'critical', 'in_progress', v_iv1, CURRENT_DATE + 3, v_obs1);
INSERT INTO public.tasks (project_id, title, priority, status, assignee_id, due_date)
VALUES (v_project_id, 'Reprise enduit façade nord', 'medium', 'done', v_iv1, CURRENT_DATE - 2);
INSERT INTO public.tasks (project_id, title, priority, status, assignee_id, due_date, obs_id)
VALUES (v_project_id, 'Mise en conformité câblage apt 204', 'critical', 'pending', v_iv3, CURRENT_DATE + 5, v_obs3);

-- Documents
INSERT INTO public.documents (project_id, name, type, file_size, version, uploader_name)
VALUES (v_project_id, 'DOE Lot Electricité', 'doe', '8.4 MB', 'v2.1', 'ElecPro Maroc');
INSERT INTO public.documents (project_id, name, type, file_size, version, uploader_name)
VALUES (v_project_id, 'Plan d''exécution Façades', 'plan', '12.1 MB', 'v3.0', 'Arc & Design');
INSERT INTO public.documents (project_id, name, type, file_size, version, uploader_name)
VALUES (v_project_id, 'Contrat sous-traitance plomberie', 'contract', '1.2 MB', 'v1.0', 'PlomberieAZ');
INSERT INTO public.documents (project_id, name, type, file_size, version, uploader_name)
VALUES (v_project_id, 'Rapport visite chantier Jan 2025', 'report', '3.6 MB', 'v1.0', 'Chef de projet');

-- Checklist
INSERT INTO public.checklists (id, project_id, name, assigned_to)
VALUES (uuid_generate_v4(), v_project_id, 'Visite sécurité hebdomadaire', v_iv1) RETURNING id INTO v_cl1;

INSERT INTO public.checklist_items (checklist_id, text, done, order_index) VALUES
(v_cl1, 'EPI port obligatoire vérifié', true, 1),
(v_cl1, 'Balisage zones dangereuses', true, 2),
(v_cl1, 'Extincteurs accessibles', false, 3),
(v_cl1, 'Issues de secours dégagées', false, 4),
(v_cl1, 'Registre présences à jour', true, 5);

RAISE NOTICE 'Seed terminé — Projet ID: %', v_project_id;
END $$;
