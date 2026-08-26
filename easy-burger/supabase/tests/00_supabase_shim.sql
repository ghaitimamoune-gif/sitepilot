-- Émulation minimale de Supabase pour valider les migrations hors ligne.
-- Ce fichier n'est PAS déployé : il n'existe que pour les tests.
create schema if not exists auth;

create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text unique
);

do $$ begin
  create role anon;          exception when duplicate_object then null; end $$;
do $$ begin
  create role authenticated; exception when duplicate_object then null; end $$;
do $$ begin
  create role service_role;  exception when duplicate_object then null; end $$;

-- auth.uid() lit un réglage de session, comme le vrai Supabase lit le JWT.
create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select coalesce(
    -- PostgREST < 10 exposait chaque claim séparément…
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    -- …les versions récentes exposent l'objet complet, comme Supabase.
    nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'sub', '')
  )::uuid;
$$;

-- Supabase accorde par défaut tous les droits de table à anon et
-- authenticated, et laisse RLS décider. On reproduit cette posture, sinon
-- les revoke ciblés des migrations ne veulent rien dire.
grant usage on schema public to anon, authenticated;
alter default privileges in schema public
  grant all on tables to anon, authenticated;
alter default privileges in schema public
  grant all on sequences to anon, authenticated;
alter default privileges in schema public
  grant execute on functions to anon, authenticated;

-- Les claims du jeton, comme les expose PostgREST.
create or replace function auth.jwt()
returns jsonb
language sql
stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb,
    '{}'::jsonb
  );
$$;

-- anon et authenticated doivent pouvoir appeler auth.uid() : les policies
-- RLS s'en servent, et elles s'évaluent avec les droits de l'appelant.
grant usage on schema auth to anon, authenticated;
grant execute on all functions in schema auth to anon, authenticated;
grant select on auth.users to authenticated;

create extension if not exists pgcrypto;
