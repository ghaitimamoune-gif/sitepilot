-- ============================================================
-- SITEPILOT — ROW LEVEL SECURITY
-- Migration 002 : Politiques de sécurité
-- ============================================================

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.intervenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.obs_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.obs_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.obs_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reserves ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reserve_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Helper
CREATE OR REPLACE FUNCTION is_project_member(p_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.project_members
    WHERE project_id = p_id AND user_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM public.projects
    WHERE id = p_id AND owner_id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- PROFILES
CREATE POLICY "profiles_read" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- PROJECTS
CREATE POLICY "projects_read" ON public.projects FOR SELECT USING (is_project_member(id));
CREATE POLICY "projects_insert" ON public.projects FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "projects_update" ON public.projects FOR UPDATE USING (owner_id = auth.uid() OR is_project_member(id));

-- PROJECT MEMBERS
CREATE POLICY "members_read" ON public.project_members FOR SELECT USING (is_project_member(project_id));
CREATE POLICY "members_insert" ON public.project_members FOR INSERT WITH CHECK (true);
CREATE POLICY "members_delete" ON public.project_members FOR DELETE USING (user_id = auth.uid());

-- INTERVENANTS
CREATE POLICY "intervenants_read" ON public.intervenants FOR SELECT USING (is_project_member(project_id));
CREATE POLICY "intervenants_write" ON public.intervenants FOR ALL USING (is_project_member(project_id));

-- PLANS
CREATE POLICY "plans_read" ON public.plans FOR SELECT USING (is_project_member(project_id));
CREATE POLICY "plans_write" ON public.plans FOR ALL USING (is_project_member(project_id));

-- OBSERVATIONS
CREATE POLICY "obs_read" ON public.observations FOR SELECT USING (is_project_member(project_id));
CREATE POLICY "obs_insert" ON public.observations FOR INSERT WITH CHECK (is_project_member(project_id));
CREATE POLICY "obs_update" ON public.observations FOR UPDATE USING (is_project_member(project_id));

-- OBS SUB-TABLES
CREATE POLICY "obs_photos_read" ON public.obs_photos FOR SELECT USING (EXISTS (SELECT 1 FROM public.observations o WHERE o.id = observation_id AND is_project_member(o.project_id)));
CREATE POLICY "obs_photos_insert" ON public.obs_photos FOR INSERT WITH CHECK (true);
CREATE POLICY "obs_comments_all" ON public.obs_comments FOR ALL USING (true);
CREATE POLICY "obs_history_all" ON public.obs_history FOR ALL USING (true);

-- RESERVES
CREATE POLICY "reserves_read" ON public.reserves FOR SELECT USING (is_project_member(project_id));
CREATE POLICY "reserves_write" ON public.reserves FOR ALL USING (is_project_member(project_id));
CREATE POLICY "reserve_photos_all" ON public.reserve_photos FOR ALL USING (true);

-- TASKS
CREATE POLICY "tasks_read" ON public.tasks FOR SELECT USING (is_project_member(project_id));
CREATE POLICY "tasks_write" ON public.tasks FOR ALL USING (is_project_member(project_id));

-- DOCUMENTS
CREATE POLICY "documents_read" ON public.documents FOR SELECT USING (is_project_member(project_id));
CREATE POLICY "documents_write" ON public.documents FOR ALL USING (is_project_member(project_id));

-- CHECKLISTS
CREATE POLICY "checklists_read" ON public.checklists FOR SELECT USING (is_project_member(project_id));
CREATE POLICY "checklists_write" ON public.checklists FOR ALL USING (is_project_member(project_id));
CREATE POLICY "checklist_items_all" ON public.checklist_items FOR ALL USING (true);

-- NOTIFICATIONS
CREATE POLICY "notifs_own" ON public.notifications FOR ALL USING (user_id = auth.uid());

-- STORAGE POLICIES
CREATE POLICY "storage_read" ON storage.objects FOR SELECT USING (bucket_id = 'sitepilot-files');
CREATE POLICY "storage_insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'sitepilot-files' AND auth.uid() IS NOT NULL);
CREATE POLICY "storage_delete" ON storage.objects FOR DELETE USING (bucket_id = 'sitepilot-files' AND auth.uid() IS NOT NULL);
