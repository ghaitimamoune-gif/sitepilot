-- ============================================================
-- SITEPILOT — SCHEMA COMPLET
-- Migration 001 : Tables, triggers, indexes
-- Exécuter dans : Supabase → SQL Editor
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- PROFILES
-- ============================================================
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  role TEXT DEFAULT 'chef_projet' CHECK (role IN ('admin','chef_projet','conducteur','intervenant','viewer')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- PROJECTS
-- ============================================================
CREATE TABLE public.projects (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT,
  description TEXT,
  phase TEXT DEFAULT 'Gros œuvre',
  start_date DATE,
  end_date DATE,
  progress INTEGER DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  owner_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Project members
CREATE TABLE public.project_members (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  role TEXT DEFAULT 'conducteur',
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, user_id)
);

-- ============================================================
-- INTERVENANTS
-- ============================================================
CREATE TABLE public.intervenants (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  contact TEXT,
  email TEXT,
  phone TEXT,
  color TEXT DEFAULT '#3D8EF0',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- PLANS
-- ============================================================
CREATE TABLE public.plans (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  zone TEXT,
  file_url TEXT,
  thumb_url TEXT,
  file_size TEXT,
  version TEXT DEFAULT 'v1.0',
  uploaded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- OBSERVATIONS
-- ============================================================
CREATE TYPE public.obs_status AS ENUM ('open','progress','corrected','validated');
CREATE TYPE public.priority_level AS ENUM ('critical','high','medium','low');

CREATE TABLE public.observations (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  plan_id UUID REFERENCES public.plans(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  priority public.priority_level DEFAULT 'high' NOT NULL,
  status public.obs_status DEFAULT 'open' NOT NULL,
  zone TEXT,
  pos_x DECIMAL(5,2),
  pos_y DECIMAL(5,2),
  intervenant_id UUID REFERENCES public.intervenants(id) ON DELETE SET NULL,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_by_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.obs_photos (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  observation_id UUID REFERENCES public.observations(id) ON DELETE CASCADE NOT NULL,
  url TEXT NOT NULL,
  caption TEXT,
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.obs_comments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  observation_id UUID REFERENCES public.observations(id) ON DELETE CASCADE NOT NULL,
  author_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  author_name TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.obs_history (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  observation_id UUID REFERENCES public.observations(id) ON DELETE CASCADE NOT NULL,
  action TEXT NOT NULL,
  by_name TEXT NOT NULL,
  by_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- RESERVES
-- ============================================================
CREATE TABLE public.reserves (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  status public.obs_status DEFAULT 'open' NOT NULL,
  priority public.priority_level DEFAULT 'high' NOT NULL,
  zone TEXT,
  plan_id UUID REFERENCES public.plans(id) ON DELETE SET NULL,
  intervenant_id UUID REFERENCES public.intervenants(id) ON DELETE SET NULL,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.reserve_photos (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  reserve_id UUID REFERENCES public.reserves(id) ON DELETE CASCADE NOT NULL,
  url TEXT NOT NULL,
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TASKS
-- ============================================================
CREATE TYPE public.task_status AS ENUM ('pending','in_progress','done');

CREATE TABLE public.tasks (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  priority public.priority_level DEFAULT 'medium' NOT NULL,
  status public.task_status DEFAULT 'pending' NOT NULL,
  assignee_id UUID REFERENCES public.intervenants(id) ON DELETE SET NULL,
  due_date DATE,
  obs_id UUID REFERENCES public.observations(id) ON DELETE SET NULL,
  reserve_id UUID REFERENCES public.reserves(id) ON DELETE SET NULL,
  phase TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- DOCUMENTS
-- ============================================================
CREATE TABLE public.documents (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  type TEXT DEFAULT 'report' CHECK (type IN ('plan','doe','contract','report','photo')),
  file_url TEXT,
  file_size TEXT,
  version TEXT DEFAULT 'v1.0',
  uploader_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  uploader_name TEXT,
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- CHECKLISTS
-- ============================================================
CREATE TABLE public.checklists (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  assigned_to UUID REFERENCES public.intervenants(id) ON DELETE SET NULL,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.checklist_items (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  checklist_id UUID REFERENCES public.checklists(id) ON DELETE CASCADE NOT NULL,
  text TEXT NOT NULL,
  done BOOLEAN DEFAULT FALSE,
  order_index INTEGER DEFAULT 0,
  done_at TIMESTAMPTZ,
  done_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

-- ============================================================
-- NOTIFICATIONS
-- ============================================================
CREATE TABLE public.notifications (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT,
  entity_id UUID,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- STORAGE BUCKET (photos & documents)
-- ============================================================
-- À exécuter dans Supabase → Storage → New bucket
-- Nom: "sitepilot-files", Public: true
-- Ou via SQL :
INSERT INTO storage.buckets (id, name, public)
VALUES ('sitepilot-files', 'sitepilot-files', true)
ON CONFLICT DO NOTHING;

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX idx_observations_project ON public.observations(project_id);
CREATE INDEX idx_observations_plan ON public.observations(plan_id);
CREATE INDEX idx_observations_status ON public.observations(status);
CREATE INDEX idx_reserves_project ON public.reserves(project_id);
CREATE INDEX idx_tasks_project ON public.tasks(project_id);
CREATE INDEX idx_tasks_assignee ON public.tasks(assignee_id);
CREATE INDEX idx_documents_project ON public.documents(project_id);
CREATE INDEX idx_notifications_user ON public.notifications(user_id, is_read);
CREATE INDEX idx_intervenants_project ON public.intervenants(project_id);

-- ============================================================
-- updated_at triggers
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_projects_updated_at BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_observations_updated_at BEFORE UPDATE ON public.observations FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_reserves_updated_at BEFORE UPDATE ON public.reserves FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_tasks_updated_at BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
