-- =============================================================================
-- Easy Burger — 000_settings
-- -----------------------------------------------------------------------------
-- Règle absolue du brief (§0) : aucune règle métier en dur dans le code.
-- Tout montant, seuil, ratio ou délai vit ici et se modifie depuis /admin.
--
-- Cette migration est la toute première : le réceptacle doit exister AVANT
-- le premier calcul, sinon la règle ne tient pas.
-- =============================================================================

create extension if not exists "pgcrypto";

create table if not exists public.settings (
  key         text primary key,
  value       jsonb       not null,
  label       text        not null,
  -- Lisible sans authentification ? Le prix de livraison oui,
  -- le plafond de points par caissier non.
  is_public   boolean     not null default false,
  updated_at  timestamptz not null default now(),
  updated_by  uuid
);

comment on table public.settings is
  'Réglages métier. Le code ne contient aucune de ces valeurs en dur (§0).';

-- ----------------------------------------------------------------- updated_at
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists settings_touch_updated_at on public.settings;
create trigger settings_touch_updated_at
  before update on public.settings
  for each row execute function public.touch_updated_at();

-- ------------------------------------------------------------------- amorçage
-- Valeurs par défaut du brief. Elles sont modifiables depuis le back-office :
-- ce sont des valeurs d'amorçage, pas la règle.
insert into public.settings (key, value, label, is_public) values
  ('points_per_mad',                to_jsonb(1),      '1 dirham dépensé = N points (§6.1)',            true),
  ('redemption_rate',               to_jsonb(10),     'N points = 1 dirham de récompense (§6.1)',      true),
  ('points_expiry_months',          to_jsonb(12),     'Expiration des points, en mois (§6.3)',         true),
  ('welcome_reward_enabled',        to_jsonb(true),   'Offre de bienvenue active (§6.3)',              true),
  ('welcome_min_order_cents',       to_jsonb(7000),   'Panier minimum pour l''offre de bienvenue',     true),
  ('birthday_reward_product_id',    'null'::jsonb,    'Dessert offert pour l''anniversaire (§6.3)',    true),
  ('delivery_fee_cents',            to_jsonb(0),      'Frais de livraison',                            true),
  ('free_delivery_threshold_cents', to_jsonb(0),      'Seuil de livraison offerte (0 = désactivé)',    true),
  ('min_order_cents',               to_jsonb(0),      'Panier minimum pour commander',                 true),
  ('opening_hours',                 'null'::jsonb,    'Horaires d''ouverture par jour',                true),
  ('is_accepting_orders',           to_jsonb(true),   'Le restaurant prend des commandes',             true),
  ('cashier_daily_points_cap',      to_jsonb(20000),  'Plafond de points par caissier et par jour (§6.5)', false)
on conflict (key) do nothing;

-- ------------------------------------------------------------------------ RLS
alter table public.settings enable row level security;

-- Lecture : les réglages publics sont lisibles par tout le monde, y compris
-- un visiteur non identifié — le menu est consultable sans compte (§8).
drop policy if exists settings_read_public on public.settings;
create policy settings_read_public
  on public.settings for select
  using (is_public);

-- Écriture : aucune. Pas de policy insert/update/delete, donc seule la clé
-- `service_role` peut écrire. Le back-office passera par une route serveur.
-- Les rôles du personnel arrivent en Phase 4 (table staff_users) ; on ne
-- crée pas de porte ouverte en attendant.
