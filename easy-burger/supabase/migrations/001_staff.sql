-- =============================================================================
-- Easy Burger — 001_staff
-- -----------------------------------------------------------------------------
-- Le personnel et ses rôles, posés AVANT le reste : toutes les policies RLS
-- des migrations suivantes s'appuient sur les fonctions définies ici.
--
-- Quatre rôles, du moins au plus puissant :
--   cashier     — crédite des points au comptoir, voit la file de commandes
--   manager     — + menu, prix, disponibilité, statuts de commande
--   admin       — + réglages, récompenses, clients
--   superadmin  — + ajustement manuel des points, gestion du personnel
--
-- Le superadmin est le compte que le patron utilise pour reprendre la main
-- sur les points d'un client, sans dépendre d'aucune API de caisse.
-- =============================================================================

create extension if not exists "pgcrypto";

create type public.staff_role as enum ('cashier', 'manager', 'admin', 'superadmin');

create table public.staff_users (
  -- Même identifiant que auth.users : le personnel se connecte par
  -- e-mail + mot de passe, indépendamment de l'auth client par téléphone.
  id         uuid primary key references auth.users (id) on delete cascade,
  name       text not null,
  phone      text,
  role       public.staff_role not null default 'cashier',
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

comment on table public.staff_users is
  'Personnel. La colonne role commande tout l''accès au back-office.';

-- --------------------------------------------------------------- hiérarchie
-- Un rang numérique rend les policies lisibles : « au moins manager »
-- s'écrit une fois et ne se discute plus.
create or replace function public.role_rank(r public.staff_role)
returns int
language sql
immutable
parallel safe
as $$
  select case r
    when 'cashier'    then 10
    when 'manager'    then 20
    when 'admin'      then 30
    when 'superadmin' then 40
  end;
$$;

create or replace function public.current_staff_role()
returns public.staff_role
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select role
  from public.staff_users
  where id = auth.uid()
    and is_active;
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
as $$
  select public.current_staff_role() is not null;
$$;

/**
 * Vrai si l'utilisateur courant a au moins le rôle demandé.
 * C'est la brique unique de toutes les policies d'écriture.
 */
create or replace function public.is_at_least(required public.staff_role)
returns boolean
language sql
stable
as $$
  select coalesce(
    public.role_rank(public.current_staff_role()) >= public.role_rank(required),
    false
  );
$$;

-- --------------------------------------------------------------- audit_log
-- Table d'audit non modifiable (§6.5). Aucune policy update ni delete :
-- même un superadmin ne peut pas réécrire l'histoire depuis l'application.
create table public.audit_log (
  id         bigserial primary key,
  actor_id   uuid references auth.users (id) on delete set null,
  actor_name text,
  action     text not null,
  entity     text not null,
  entity_id  text,
  payload    jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index audit_log_entity_idx on public.audit_log (entity, entity_id, created_at desc);
create index audit_log_actor_idx on public.audit_log (actor_id, created_at desc);

create or replace function public.write_audit(
  p_action    text,
  p_entity    text,
  p_entity_id text,
  p_payload   jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_name text;
begin
  select name into v_name from public.staff_users where id = auth.uid();

  insert into public.audit_log (actor_id, actor_name, action, entity, entity_id, payload)
  values (auth.uid(), v_name, p_action, p_entity, p_entity_id, coalesce(p_payload, '{}'::jsonb));
end;
$$;

-- ------------------------------------------------------------------------ RLS
alter table public.staff_users enable row level security;
alter table public.audit_log   enable row level security;

-- Chacun lit sa propre fiche ; à partir d'admin, on lit toute l'équipe.
create policy staff_read_self_or_admin
  on public.staff_users for select
  using (id = auth.uid() or public.is_at_least('admin'));

-- Seul un superadmin gère le personnel : c'est ce qui empêche un admin
-- de se promouvoir lui-même.
create policy staff_write_superadmin
  on public.staff_users for all
  using (public.is_at_least('superadmin'))
  with check (public.is_at_least('superadmin'));

create policy audit_read_admin
  on public.audit_log for select
  using (public.is_at_least('admin'));

-- Écriture uniquement via public.write_audit (security definer).
-- Pas de policy insert : personne n'écrit dans l'audit à la main.

-- ------------------------------------------------------- amorçage du premier
-- Il n'existe aucun chemin applicatif pour créer le premier superadmin —
-- ce serait une porte ouverte. On le crée à la main, une fois :
--
--   1. Dashboard Supabase → Authentication → Users → Add user
--      (e-mail + mot de passe, « Auto Confirm User » coché)
--   2. Copier l'UUID créé, puis dans le SQL Editor :
--
--        insert into public.staff_users (id, name, role)
--        values ('<uuid-copié>', 'Mamoune', 'superadmin');
--
-- Ensuite, tout le reste du personnel se crée depuis /admin/equipe.

-- ------------------------------------- ouverture des réglages au personnel
-- La migration 000 créait `settings` sans droit d'écriture : les rôles
-- n'existaient pas encore. Maintenant qu'ils existent, on branche.
create policy settings_read_staff
  on public.settings for select
  using (public.is_staff());

create policy settings_write_admin
  on public.settings for update
  using (public.is_at_least('admin'))
  with check (public.is_at_least('admin'));
