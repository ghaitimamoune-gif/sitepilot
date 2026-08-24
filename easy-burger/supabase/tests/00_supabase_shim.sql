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
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

create extension if not exists pgcrypto;
