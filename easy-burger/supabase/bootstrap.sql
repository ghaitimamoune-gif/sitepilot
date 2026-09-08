-- ===========================================================================
-- Easy Burger — amorçage complet de la base
--
-- FICHIER GÉNÉRÉ. Ne pas modifier à la main : il est reconstruit par
--   ./supabase/build-bootstrap.sh
-- à partir des migrations, qui restent la source de vérité.
--
-- À coller en une fois dans Supabase → SQL Editor, sur un projet neuf.
-- ===========================================================================


-- ─── 000_settings.sql ───────────────────────────────────────────────

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

-- ─── 001_staff.sql ───────────────────────────────────────────────

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

-- ─── 002_catalog.sql ───────────────────────────────────────────────

-- =============================================================================
-- Easy Burger — 002_catalog
-- -----------------------------------------------------------------------------
-- Le menu vit en base, jamais dans le code (§5). Prix en centimes entiers (§7).
-- =============================================================================

create table public.restaurants (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  address       text,
  phone         text,
  is_open       boolean not null default true,
  opening_hours jsonb,
  created_at    timestamptz not null default now()
);

create table public.categories (
  id         uuid primary key default gen_random_uuid(),
  slug       text not null unique,
  name       text not null,
  sort_order int  not null default 0,
  is_active  boolean not null default true
);

create table public.products (
  id            uuid primary key default gen_random_uuid(),
  category_id   uuid not null references public.categories (id) on delete restrict,
  slug          text not null unique,
  name          text not null,
  description   text,
  -- §7 : centimes, entier. Jamais de flottant sur de l'argent.
  price_cents   int  not null check (price_cents >= 0),
  image_url     text,
  sort_order    int  not null default 0,
  is_available  boolean not null default true,
  is_featured   boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index products_category_idx on public.products (category_id, sort_order);

create trigger products_touch_updated_at
  before update on public.products
  for each row execute function public.touch_updated_at();

create type public.option_type as enum ('single', 'multi');

create table public.product_options (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references public.products (id) on delete cascade,
  name        text not null,
  type        public.option_type not null default 'single',
  is_required boolean not null default false,
  sort_order  int not null default 0
);

create index product_options_product_idx on public.product_options (product_id, sort_order);

create table public.product_option_values (
  id                uuid primary key default gen_random_uuid(),
  option_id         uuid not null references public.product_options (id) on delete cascade,
  name              text not null,
  -- Peut être négatif (une option qui retire un ingrédient et remise le prix).
  price_delta_cents int not null default 0,
  is_available      boolean not null default true,
  sort_order        int not null default 0
);

create index product_option_values_option_idx on public.product_option_values (option_id, sort_order);

-- ------------------------------------------------------------------------ RLS
alter table public.restaurants           enable row level security;
alter table public.categories            enable row level security;
alter table public.products              enable row level security;
alter table public.product_options       enable row level security;
alter table public.product_option_values enable row level security;

-- §8 : le menu est consultable sans compte. Lecture ouverte à tous,
-- y compris un visiteur anonyme.
create policy restaurants_read_all on public.restaurants for select using (true);
create policy categories_read_all  on public.categories  for select using (is_active or public.is_staff());
create policy products_read_all    on public.products    for select using (true);
create policy options_read_all     on public.product_options       for select using (true);
create policy option_values_read_all on public.product_option_values for select using (true);

-- Écriture : à partir de manager (rupture de stock en un clic, prix, photos).
create policy restaurants_write on public.restaurants for all
  using (public.is_at_least('manager')) with check (public.is_at_least('manager'));
create policy categories_write on public.categories for all
  using (public.is_at_least('manager')) with check (public.is_at_least('manager'));
create policy products_write on public.products for all
  using (public.is_at_least('manager')) with check (public.is_at_least('manager'));
create policy options_write on public.product_options for all
  using (public.is_at_least('manager')) with check (public.is_at_least('manager'));
create policy option_values_write on public.product_option_values for all
  using (public.is_at_least('manager')) with check (public.is_at_least('manager'));

-- ─── 003_customers.sql ───────────────────────────────────────────────

-- =============================================================================
-- Easy Burger — 003_customers
-- -----------------------------------------------------------------------------
-- §2 : identifier chaque client par son numéro de téléphone, quel que soit
-- le canal. §6.5 : un numéro de téléphone = un compte.
--
-- Cette règle ne tient que si le numéro est normalisé AVANT d'atteindre la
-- contrainte d'unicité. « 0612345678 », « +212 612 345 678 » et
-- « 212612345678 » sont le même client ; sans normalisation, ce sont trois
-- comptes, trois soldes, et une offre de bienvenue réclamée trois fois.
-- =============================================================================

/**
 * Normalise un numéro marocain en E.164 (+212XXXXXXXXX).
 * Renvoie null si le numéro est inexploitable — l'appelant décide quoi en faire.
 */
create or replace function public.normalize_phone(raw text)
returns text
language plpgsql
immutable
as $$
declare
  d text;
begin
  if raw is null then return null; end if;

  -- On ne garde que les chiffres.
  d := regexp_replace(raw, '\D', '', 'g');

  -- 00212… → 212…
  if d like '00212%' then
    d := substr(d, 3);
  end if;

  -- 0612345678 (10 chiffres, national) → 212612345678
  if length(d) = 10 and left(d, 1) = '0' then
    d := '212' || substr(d, 2);
  end if;

  -- 612345678 (9 chiffres, sans préfixe) → 212612345678
  if length(d) = 9 and left(d, 1) in ('6', '7', '5') then
    d := '212' || d;
  end if;

  if length(d) = 12 and left(d, 3) = '212' then
    return '+' || d;
  end if;

  -- Numéro étranger plausible : on le garde tel quel en E.164.
  if length(d) between 8 and 15 then
    return '+' || d;
  end if;

  return null;
end;
$$;

create table public.customers (
  id                uuid primary key default gen_random_uuid(),
  -- Toujours en E.164. La contrainte d'unicité est LA garantie du §6.5.
  phone             text not null unique
                    check (phone ~ '^\+[0-9]{8,15}$'),
  first_name        text,
  last_name         text,
  email             text,
  birthdate         date,
  -- §6.3 : la date de naissance n'est modifiable qu'une fois.
  birthdate_set_at  timestamptz,

  -- Caches entretenus par trigger. Le ledger fait foi (§7).
  points_balance    int  not null default 0,
  lifetime_spend    bigint not null default 0,
  orders_count      int  not null default 0,
  last_order_at     timestamptz,

  marketing_consent boolean not null default false,
  consent_at        timestamptz,

  -- Rattachement au compte Supabase Auth, quand le client s'identifie
  -- par OTP (Phase 2). Un client créé au comptoir n'en a pas.
  auth_user_id      uuid unique references auth.users (id) on delete set null,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index customers_last_order_idx on public.customers (last_order_at desc nulls last);

create trigger customers_touch_updated_at
  before update on public.customers
  for each row execute function public.touch_updated_at();

/**
 * Normalise le téléphone à l'écriture. Impossible d'insérer un numéro
 * mal formé, même en passant à côté de l'application.
 */
create or replace function public.customers_normalize_phone()
returns trigger
language plpgsql
as $$
begin
  new.phone := public.normalize_phone(new.phone);
  if new.phone is null then
    raise exception 'Numéro de téléphone inexploitable';
  end if;
  return new;
end;
$$;

create trigger customers_normalize_phone
  before insert or update of phone on public.customers
  for each row execute function public.customers_normalize_phone();

/** §6.3 : la date de naissance n'est modifiable qu'une fois. */
create or replace function public.customers_lock_birthdate()
returns trigger
language plpgsql
as $$
begin
  if old.birthdate is not null
     and new.birthdate is distinct from old.birthdate
     and not public.is_at_least('admin') then
    raise exception 'La date de naissance a déjà été renseignée';
  end if;

  if new.birthdate is not null and old.birthdate is null then
    new.birthdate_set_at := now();
  end if;

  return new;
end;
$$;

create trigger customers_lock_birthdate
  before update of birthdate on public.customers
  for each row execute function public.customers_lock_birthdate();

-- ------------------------------------------------------------------ adresses
create table public.addresses (
  id          uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers (id) on delete cascade,
  label       text,
  street      text not null,
  details     text,
  lat         double precision,
  lng         double precision,
  is_default  boolean not null default false,
  created_at  timestamptz not null default now()
);

create index addresses_customer_idx on public.addresses (customer_id);

-- Une seule adresse par défaut par client.
create unique index addresses_one_default_idx
  on public.addresses (customer_id)
  where is_default;

-- ------------------------------------------------------------------------ RLS
alter table public.customers enable row level security;
alter table public.addresses enable row level security;

-- Le client lit sa propre fiche (dès que l'auth par OTP existe, Phase 2).
create policy customers_read_self
  on public.customers for select
  using (auth_user_id = auth.uid());

create policy customers_update_self
  on public.customers for update
  using (auth_user_id = auth.uid())
  with check (auth_user_id = auth.uid());

-- Le personnel lit la base clients dès le rôle caissier : il doit pouvoir
-- retrouver un client par son numéro au comptoir.
create policy customers_read_staff
  on public.customers for select
  using (public.is_staff());

-- Modification de fiche : à partir d'admin. Les points ne se modifient
-- JAMAIS par un update direct de points_balance — voir 004_loyalty.
create policy customers_write_admin
  on public.customers for update
  using (public.is_at_least('admin'))
  with check (public.is_at_least('admin'));

create policy addresses_rw_self
  on public.addresses for all
  using (exists (
    select 1 from public.customers c
    where c.id = addresses.customer_id and c.auth_user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.customers c
    where c.id = addresses.customer_id and c.auth_user_id = auth.uid()
  ));

create policy addresses_read_staff
  on public.addresses for select
  using (public.is_staff());

-- ─── 004_orders.sql ───────────────────────────────────────────────

-- =============================================================================
-- Easy Burger — 004_orders
-- -----------------------------------------------------------------------------
-- §7 : une commande passée ne doit jamais changer parce qu'un prix a bougé.
-- D'où les colonnes `*_snapshot` sur les lignes : elles figent le nom et le
-- prix au moment de la commande.
--
-- Le client n'insère JAMAIS de commande directement : tout passe par
-- public.place_order(), qui recalcule chaque prix depuis la base. Un panier
-- trafiqué côté navigateur ne peut pas changer le total.
-- =============================================================================

create type public.order_channel as enum ('app', 'counter', 'glovo');
create type public.order_mode    as enum ('delivery', 'pickup');
create type public.order_status  as enum (
  'received', 'preparing', 'ready', 'delivering', 'completed', 'cancelled'
);
create type public.payment_method as enum ('cash', 'card_online');
create type public.payment_status as enum ('pending', 'paid', 'failed', 'refunded');

-- Numérotation lisible, remise à zéro chaque jour : « EB-260824-007 ».
-- C'est ce numéro que le client annonce au comptoir.
create table public.order_counters (
  day         date primary key,
  last_number int not null default 0
);

create table public.orders (
  id                 uuid primary key default gen_random_uuid(),
  order_number       text unique,
  -- Jeton de suivi : permet à un client non identifié d'ouvrir sa page de
  -- suivi sans exposer d'identifiant devinable.
  public_token       uuid not null unique default gen_random_uuid(),

  customer_id        uuid references public.customers (id) on delete set null,
  restaurant_id      uuid references public.restaurants (id) on delete set null,

  channel            public.order_channel not null default 'app',
  mode               public.order_mode    not null,
  status             public.order_status  not null default 'received',

  subtotal_cents     int not null default 0 check (subtotal_cents >= 0),
  delivery_fee_cents int not null default 0 check (delivery_fee_cents >= 0),
  discount_cents     int not null default 0 check (discount_cents >= 0),
  total_cents        int not null default 0 check (total_cents >= 0),

  payment_method     public.payment_method not null default 'cash',
  payment_status     public.payment_status not null default 'pending',

  address_id         uuid references public.addresses (id) on delete set null,
  -- Recopiés sur la commande : une adresse supprimée ne doit pas effacer
  -- l'adresse de livraison d'une commande passée.
  address_snapshot   text,
  contact_name       text,
  contact_phone      text,

  note               text,
  placed_at          timestamptz not null default now(),
  completed_at       timestamptz,
  cancelled_at       timestamptz,
  cancel_reason      text
);

create index orders_status_idx   on public.orders (status, placed_at desc);
create index orders_customer_idx on public.orders (customer_id, placed_at desc);
create index orders_placed_idx   on public.orders (placed_at desc);

create table public.order_items (
  id                uuid primary key default gen_random_uuid(),
  order_id          uuid not null references public.orders (id) on delete cascade,
  product_id        uuid references public.products (id) on delete set null,
  name_snapshot     text not null,
  unit_price_cents  int  not null check (unit_price_cents >= 0),
  qty               int  not null check (qty > 0),
  line_total_cents  int  not null check (line_total_cents >= 0)
);

create index order_items_order_idx on public.order_items (order_id);

create table public.order_item_options (
  id                uuid primary key default gen_random_uuid(),
  order_item_id     uuid not null references public.order_items (id) on delete cascade,
  option_value_id   uuid references public.product_option_values (id) on delete set null,
  name_snapshot     text not null,
  price_delta_cents int not null default 0
);

create index order_item_options_item_idx on public.order_item_options (order_item_id);

-- ------------------------------------------------------------ numérotation
create or replace function public.next_order_number()
returns text
language plpgsql
as $$
declare
  n int;
begin
  insert into public.order_counters (day, last_number)
  values (current_date, 1)
  on conflict (day) do update
    set last_number = public.order_counters.last_number + 1
  returning last_number into n;

  return 'EB-' || to_char(current_date, 'YYMMDD') || '-' || lpad(n::text, 3, '0');
end;
$$;

-- =============================================================================
-- place_order — le seul chemin d'écriture d'une commande
-- -----------------------------------------------------------------------------
-- Payload attendu :
-- {
--   "mode": "delivery" | "pickup",
--   "phone": "0612345678",
--   "name": "Yasmine",
--   "note": "sans oignons",
--   "address": "12 rue X, Casablanca",
--   "items": [{ "product_id": "...", "qty": 2, "options": ["uuid", ...] }]
-- }
--
-- Tous les prix sont relus en base. Le client ne transmet que des
-- identifiants et des quantités : il ne peut pas influencer un montant.
-- =============================================================================
create or replace function public.place_order(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_mode        public.order_mode;
  v_phone       text;
  v_customer_id uuid;
  v_order_id    uuid;
  v_item        jsonb;
  v_product     public.products%rowtype;
  v_unit        int;
  v_subtotal    int := 0;
  v_fee         int := 0;
  v_total       int;
  v_item_id     uuid;
  v_opt_id      uuid;
  v_opt         public.product_option_values%rowtype;
  v_settings    jsonb;
  v_min_order   int;
  v_free_thr    int;
  v_restaurant  uuid;
  v_qty         int;
begin
  -- ------------------------------------------------------------- réglages
  select jsonb_object_agg(key, value) into v_settings from public.settings;

  if coalesce((v_settings->>'is_accepting_orders')::boolean, true) is not true then
    raise exception 'Le restaurant ne prend pas de commandes en ce moment'
      using errcode = 'check_violation';
  end if;

  v_min_order := coalesce((v_settings->>'min_order_cents')::int, 0);
  v_free_thr  := coalesce((v_settings->>'free_delivery_threshold_cents')::int, 0);

  -- --------------------------------------------------------------- entrées
  v_mode := (payload->>'mode')::public.order_mode;

  v_phone := public.normalize_phone(payload->>'phone');
  if v_phone is null then
    raise exception 'Numéro de téléphone inexploitable' using errcode = 'check_violation';
  end if;

  if jsonb_array_length(coalesce(payload->'items', '[]'::jsonb)) = 0 then
    raise exception 'Panier vide' using errcode = 'check_violation';
  end if;

  if v_mode = 'delivery' and coalesce(trim(payload->>'address'), '') = '' then
    raise exception 'Adresse de livraison manquante' using errcode = 'check_violation';
  end if;

  -- ------------------------------------------- client, créé à la volée si besoin
  -- §6.4b : si le numéro n'existe pas, le compte est créé avec le seul
  -- téléphone ; le client complètera son profil plus tard.
  insert into public.customers (phone, first_name)
  values (v_phone, nullif(trim(payload->>'name'), ''))
  on conflict (phone) do update
    set first_name = coalesce(public.customers.first_name, excluded.first_name)
  returning id into v_customer_id;

  select id into v_restaurant from public.restaurants order by created_at limit 1;

  insert into public.orders (
    order_number, customer_id, restaurant_id, channel, mode, status,
    payment_method, payment_status, contact_name, contact_phone,
    address_snapshot, note
  ) values (
    public.next_order_number(), v_customer_id, v_restaurant, 'app', v_mode, 'received',
    'cash', 'pending', nullif(trim(payload->>'name'), ''), v_phone,
    case when v_mode = 'delivery' then trim(payload->>'address') end,
    nullif(trim(payload->>'note'), '')
  )
  returning id into v_order_id;

  -- ---------------------------------------------------------------- lignes
  for v_item in select * from jsonb_array_elements(payload->'items')
  loop
    select * into v_product
    from public.products
    where id = (v_item->>'product_id')::uuid;

    if not found then
      raise exception 'Produit introuvable' using errcode = 'check_violation';
    end if;

    if not v_product.is_available then
      raise exception '% n''est plus disponible', v_product.name
        using errcode = 'check_violation';
    end if;

    v_qty := greatest(1, least(coalesce((v_item->>'qty')::int, 1), 50));
    v_unit := v_product.price_cents;

    insert into public.order_items (
      order_id, product_id, name_snapshot, unit_price_cents, qty, line_total_cents
    ) values (v_order_id, v_product.id, v_product.name, 0, v_qty, 0)
    returning id into v_item_id;

    -- Options : le delta de prix est relu en base, jamais transmis.
    for v_opt_id in
      select (value #>> '{}')::uuid from jsonb_array_elements(coalesce(v_item->'options', '[]'::jsonb))
    loop
      select v.* into v_opt
      from public.product_option_values v
      join public.product_options o on o.id = v.option_id
      where v.id = v_opt_id
        and o.product_id = v_product.id
        and v.is_available;

      if not found then
        raise exception 'Option indisponible pour %', v_product.name
          using errcode = 'check_violation';
      end if;

      v_unit := v_unit + v_opt.price_delta_cents;

      insert into public.order_item_options (
        order_item_id, option_value_id, name_snapshot, price_delta_cents
      ) values (v_item_id, v_opt.id, v_opt.name, v_opt.price_delta_cents);
    end loop;

    v_unit := greatest(v_unit, 0);

    update public.order_items
      set unit_price_cents = v_unit,
          line_total_cents = v_unit * v_qty
      where id = v_item_id;

    v_subtotal := v_subtotal + v_unit * v_qty;
  end loop;

  -- ------------------------------------------------------------- livraison
  if v_mode = 'delivery' then
    v_fee := coalesce((v_settings->>'delivery_fee_cents')::int, 0);
    if v_free_thr > 0 and v_subtotal >= v_free_thr then
      v_fee := 0;
    end if;
  end if;

  if v_min_order > 0 and v_subtotal < v_min_order then
    raise exception 'Commande minimum : % MAD', (v_min_order / 100)
      using errcode = 'check_violation';
  end if;

  v_total := v_subtotal + v_fee;

  update public.orders
    set subtotal_cents = v_subtotal,
        delivery_fee_cents = v_fee,
        total_cents = v_total
    where id = v_order_id;

  return (
    select jsonb_build_object(
      'id', o.id,
      'order_number', o.order_number,
      'public_token', o.public_token,
      'total_cents', o.total_cents
    )
    from public.orders o where o.id = v_order_id
  );
end;
$$;

revoke all on function public.place_order(jsonb) from public;
grant execute on function public.place_order(jsonb) to anon, authenticated;

-- ------------------------------------------------------- suivi anonyme
/** Lecture d'une commande par son jeton public, sans authentification. */
create or replace function public.get_order_by_token(p_token uuid)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'order_number', o.order_number,
    'status', o.status,
    'mode', o.mode,
    'placed_at', o.placed_at,
    'subtotal_cents', o.subtotal_cents,
    'delivery_fee_cents', o.delivery_fee_cents,
    'total_cents', o.total_cents,
    'contact_name', o.contact_name,
    'address_snapshot', o.address_snapshot,
    'note', o.note,
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'name', i.name_snapshot,
        'qty', i.qty,
        'line_total_cents', i.line_total_cents,
        'options', coalesce((
          select jsonb_agg(op.name_snapshot order by op.name_snapshot)
          from public.order_item_options op where op.order_item_id = i.id
        ), '[]'::jsonb)
      ) order by i.name_snapshot)
      from public.order_items i where i.order_id = o.id
    ), '[]'::jsonb)
  )
  from public.orders o
  where o.public_token = p_token;
$$;

revoke all on function public.get_order_by_token(uuid) from public;
grant execute on function public.get_order_by_token(uuid) to anon, authenticated;

-- ------------------------------------------------------------------------ RLS
alter table public.orders             enable row level security;
alter table public.order_items        enable row level security;
alter table public.order_item_options enable row level security;
alter table public.order_counters     enable row level security;

-- Aucune policy insert : place_order est le seul chemin.
create policy orders_read_staff on public.orders for select using (public.is_staff());
create policy orders_read_self  on public.orders for select
  using (exists (
    select 1 from public.customers c
    where c.id = orders.customer_id and c.auth_user_id = auth.uid()
  ));

-- Le changement de statut passe par set_order_status ; cette policy couvre
-- l'annulation et les corrections depuis le back-office.
create policy orders_write_staff on public.orders for update
  using (public.is_at_least('cashier')) with check (public.is_at_least('cashier'));

create policy order_items_read on public.order_items for select
  using (exists (
    select 1 from public.orders o
    where o.id = order_items.order_id
      and (public.is_staff() or exists (
        select 1 from public.customers c
        where c.id = o.customer_id and c.auth_user_id = auth.uid()
      ))
  ));

create policy order_item_options_read on public.order_item_options for select
  using (exists (
    select 1 from public.order_items i
    join public.orders o on o.id = i.order_id
    where i.id = order_item_options.order_item_id
      and (public.is_staff() or exists (
        select 1 from public.customers c
        where c.id = o.customer_id and c.auth_user_id = auth.uid()
      ))
  ));

-- order_counters : aucune policy. Seule next_order_number (appelée depuis
-- place_order, security definer) y touche.

-- ─── 005_loyalty.sql ───────────────────────────────────────────────

-- =============================================================================
-- Easy Burger — 005_loyalty
-- -----------------------------------------------------------------------------
-- Le ledger de points. Deux garanties structurelles :
--
-- 1. UN TICKET = UN CRÉDIT, JAMAIS DEUX.
--    L'index unique (source_type, source_ref) rend le double crédit
--    impossible au niveau de la base — pas au niveau du code. Que le crédit
--    vienne d'une commande de l'app, d'un ticket de caisse saisi au comptoir
--    ou d'un code Glovo, une seconde tentative sur la même référence est
--    rejetée par Postgres. Deux caissiers qui saisissent le même ticket en
--    même temps : le second reçoit une erreur, pas un doublon.
--
-- 2. AUCUNE ÉCRITURE DE POINTS DEPUIS LE CLIENT (§3, §6.5).
--    Toutes les fonctions ci-dessous sont `security definer` et la table
--    n'a aucune policy d'insertion. `customers.points_balance` est un cache
--    entretenu par trigger : le ledger fait foi et se recalcule à tout moment.
-- =============================================================================

create type public.loyalty_type as enum ('earn', 'redeem', 'bonus', 'adjust', 'expire');

create type public.loyalty_source as enum (
  'app_order',   -- commande passée sur l'app
  'pos_ticket',  -- ticket de caisse saisi au comptoir
  'glovo_code',  -- code à usage unique du sticker de sac
  'ticket_claim',-- réclamation d'un ticket par le client (Phase 5)
  'manual',      -- ajustement par un superadmin
  'welcome',     -- offre de bienvenue
  'birthday',    -- offre d'anniversaire
  'reward',      -- utilisation d'une récompense
  'expiry'       -- péremption d'un lot
);

create table public.loyalty_transactions (
  id          uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers (id) on delete cascade,
  type        public.loyalty_type   not null,
  source      public.loyalty_source not null,
  -- Référence de la source. Commande, numéro de ticket, code de sac.
  -- C'est cette valeur qui porte l'unicité.
  source_ref  text,
  order_id    uuid references public.orders (id) on delete set null,
  -- Signé : positif pour un gain, négatif pour une dépense ou une péremption.
  points      int not null check (points <> 0),
  -- Montant qui a généré le gain, pour la traçabilité et le rapprochement caisse.
  amount_cents int,
  expires_at  timestamptz,
  created_by  uuid references auth.users (id) on delete set null,
  note        text,
  created_at  timestamptz not null default now()
);

create index loyalty_customer_idx on public.loyalty_transactions (customer_id, created_at desc);
create index loyalty_expiry_idx   on public.loyalty_transactions (expires_at)
  where type = 'earn' and expires_at is not null;

-- ============================ LA garantie ====================================
-- Une référence de source ne peut être créditée qu'une seule fois.
-- Partiel : les ajustements manuels (source_ref null) restent répétables,
-- c'est leur raison d'être.
create unique index loyalty_unique_source_ref
  on public.loyalty_transactions (source, source_ref)
  where source_ref is not null;
-- =============================================================================

comment on index public.loyalty_unique_source_ref is
  'Un ticket = un crédit. Le double crédit est impossible, y compris en cas '
  'de saisie simultanée par deux caissiers.';

-- ---------------------------------------------- cache du solde (le ledger fait foi)
create or replace function public.refresh_points_balance()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_customer uuid := coalesce(new.customer_id, old.customer_id);
begin
  update public.customers c
     set points_balance = coalesce((
           select sum(t.points)
           from public.loyalty_transactions t
           where t.customer_id = v_customer
         ), 0)
   where c.id = v_customer;
  return null;
end;
$$;

create trigger loyalty_refresh_balance
  after insert or update or delete on public.loyalty_transactions
  for each row execute function public.refresh_points_balance();

-- ------------------------------------------------------------ calcul du gain
/** Points gagnés pour un montant, d'après les réglages (§6.1). */
create or replace function public.points_for_amount(p_amount_cents int)
returns int
language sql
stable
as $$
  select greatest(
    0,
    floor(greatest(p_amount_cents, 0) / 100.0)::int
      * coalesce((select (value #>> '{}')::int from public.settings where key = 'points_per_mad'), 1)
  );
$$;

create or replace function public.points_expiry_at()
returns timestamptz
language sql
stable
as $$
  select now() + make_interval(
    months => coalesce(
      (select (value #>> '{}')::int from public.settings where key = 'points_expiry_months'),
      12
    )
  );
$$;

-- =============================================================================
-- Crédit d'une commande passée sur l'app
-- =============================================================================
create or replace function public.credit_order_points(p_order_id uuid)
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order  public.orders%rowtype;
  v_points int;
begin
  select * into v_order from public.orders where id = p_order_id;
  if not found or v_order.customer_id is null then
    return 0;
  end if;

  -- On crédite sur le montant des produits, pas sur les frais de livraison :
  -- le client ne gagne pas de points sur une course Glovo.
  v_points := public.points_for_amount(v_order.subtotal_cents - v_order.discount_cents);
  if v_points = 0 then
    return 0;
  end if;

  begin
    insert into public.loyalty_transactions (
      customer_id, type, source, source_ref, order_id, points, amount_cents, expires_at
    ) values (
      v_order.customer_id, 'earn', 'app_order', p_order_id::text, p_order_id,
      v_points, v_order.subtotal_cents - v_order.discount_cents, public.points_expiry_at()
    );
  exception when unique_violation then
    -- Commande déjà créditée : on ne recrédite pas, et ce n'est pas une erreur.
    return 0;
  end;

  return v_points;
end;
$$;

-- =============================================================================
-- Changement de statut d'une commande — porte d'entrée du crédit automatique
-- =============================================================================
create or replace function public.set_order_status(
  p_order_id uuid,
  p_status   public.order_status,
  p_reason   text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order  public.orders%rowtype;
  v_points int := 0;
begin
  if not public.is_at_least('cashier') then
    raise exception 'Accès refusé' using errcode = 'insufficient_privilege';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'Commande introuvable';
  end if;

  if v_order.status = p_status then
    return jsonb_build_object('status', p_status, 'points_credited', 0);
  end if;

  update public.orders
     set status        = p_status,
         completed_at  = case when p_status = 'completed' then now() else completed_at end,
         cancelled_at  = case when p_status = 'cancelled' then now() else cancelled_at end,
         cancel_reason = case when p_status = 'cancelled' then p_reason else cancel_reason end,
         payment_status = case
                            when p_status = 'completed' and payment_method = 'cash'
                            then 'paid'::public.payment_status
                            else payment_status
                          end
   where id = p_order_id;

  -- §6.4a : le crédit est automatique au passage en `completed`.
  if p_status = 'completed' then
    v_points := public.credit_order_points(p_order_id);

    -- Les compteurs ne bougent qu'au PREMIER passage en terminée.
    -- Sans ce garde-fou, un responsable qui repasse une commande en
    -- préparation puis à nouveau en terminée gonfle la dépense cumulée et
    -- le nombre de commandes du client. Les points, eux, sont déjà protégés
    -- par l'index unique du ledger : ce sont bien les compteurs qui
    -- manquaient d'une garde.
    if v_order.completed_at is null then
      update public.customers c
         set orders_count   = c.orders_count + 1,
             lifetime_spend = c.lifetime_spend + v_order.total_cents,
             last_order_at  = now()
       where c.id = v_order.customer_id;
    end if;
  end if;

  perform public.write_audit(
    'order.status', 'orders', p_order_id::text,
    jsonb_build_object('from', v_order.status, 'to', p_status, 'points', v_points, 'reason', p_reason)
  );

  return jsonb_build_object('status', p_status, 'points_credited', v_points);
end;
$$;

-- =============================================================================
-- Crédit au comptoir par numéro de ticket (§6.4b, §11.2)
-- -----------------------------------------------------------------------------
-- Ne dépend d'AUCUNE API de caisse. Le caissier saisit numéro + montant +
-- référence du ticket. Le même ticket ne peut jamais être crédité deux fois.
-- =============================================================================
create or replace function public.credit_ticket_points(
  p_phone        text,
  p_amount_cents int,
  p_ticket_ref   text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_phone       text;
  v_ref         text;
  v_customer_id uuid;
  v_created     boolean := false;
  v_points      int;
  v_cap         int;
  v_today       int;
begin
  if not public.is_at_least('cashier') then
    raise exception 'Accès refusé' using errcode = 'insufficient_privilege';
  end if;

  v_phone := public.normalize_phone(p_phone);
  if v_phone is null then
    raise exception 'Numéro de téléphone inexploitable' using errcode = 'check_violation';
  end if;

  -- Normalisation de la référence : « a-1042 » et « A 1042 » sont le même
  -- ticket. Sans ça, l'unicité se contourne avec un espace.
  v_ref := upper(regexp_replace(coalesce(p_ticket_ref, ''), '[^A-Za-z0-9]', '', 'g'));
  if v_ref = '' then
    raise exception 'Référence de ticket manquante' using errcode = 'check_violation';
  end if;

  if coalesce(p_amount_cents, 0) <= 0 then
    raise exception 'Montant du ticket manquant' using errcode = 'check_violation';
  end if;

  v_points := public.points_for_amount(p_amount_cents);
  if v_points = 0 then
    raise exception 'Montant trop faible pour générer des points'
      using errcode = 'check_violation';
  end if;

  -- §6.5 : plafond de points par caissier et par jour, avec alerte au-delà.
  v_cap := coalesce(
    (select (value #>> '{}')::int from public.settings where key = 'cashier_daily_points_cap'),
    20000
  );

  select coalesce(sum(points), 0) into v_today
  from public.loyalty_transactions
  where created_by = auth.uid()
    and source = 'pos_ticket'
    and created_at >= date_trunc('day', now());

  if v_today + v_points > v_cap then
    raise exception 'Plafond quotidien de points atteint pour ce caissier (% points). Préviens un responsable.', v_cap
      using errcode = 'check_violation';
  end if;

  -- §6.4b : compte créé à la volée avec le seul téléphone si le numéro
  -- n'existe pas encore.
  select id into v_customer_id from public.customers where phone = v_phone;
  if not found then
    insert into public.customers (phone) values (v_phone) returning id into v_customer_id;
    v_created := true;
  end if;

  begin
    insert into public.loyalty_transactions (
      customer_id, type, source, source_ref, points, amount_cents, expires_at, created_by
    ) values (
      v_customer_id, 'earn', 'pos_ticket', v_ref,
      v_points, p_amount_cents, public.points_expiry_at(), auth.uid()
    );
  exception when unique_violation then
    raise exception 'Le ticket % a déjà été crédité.', v_ref
      using errcode = 'unique_violation';
  end;

  perform public.write_audit(
    'loyalty.credit_ticket', 'customers', v_customer_id::text,
    jsonb_build_object('ticket_ref', v_ref, 'amount_cents', p_amount_cents, 'points', v_points)
  );

  return jsonb_build_object(
    'customer_id', v_customer_id,
    'phone', v_phone,
    'points_credited', v_points,
    'new_balance', (select points_balance from public.customers where id = v_customer_id),
    'customer_created', v_created,
    'ticket_ref', v_ref
  );
end;
$$;

-- =============================================================================
-- Ajustement manuel par un superadmin (§10)
-- -----------------------------------------------------------------------------
-- C'est le filet de sécurité qui ne dépend d'aucun système externe : quoi
-- qu'il arrive à la caisse, à Glovo ou au réseau, le patron peut corriger
-- le solde d'un client à la main. Motif obligatoire, tracé dans l'audit.
-- =============================================================================
create or replace function public.adjust_points(
  p_customer_id uuid,
  p_points      int,
  p_reason      text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_balance int;
begin
  if not public.is_at_least('superadmin') then
    raise exception 'Seul un superadmin peut ajuster des points'
      using errcode = 'insufficient_privilege';
  end if;

  if p_points = 0 then
    raise exception 'Indique un nombre de points différent de zéro'
      using errcode = 'check_violation';
  end if;

  if coalesce(trim(p_reason), '') = '' then
    raise exception 'Le motif est obligatoire' using errcode = 'check_violation';
  end if;

  select points_balance into v_balance from public.customers where id = p_customer_id;
  if not found then
    raise exception 'Client introuvable';
  end if;

  if v_balance + p_points < 0 then
    raise exception 'Le solde ne peut pas devenir négatif (solde actuel : %)', v_balance
      using errcode = 'check_violation';
  end if;

  insert into public.loyalty_transactions (
    customer_id, type, source, points, note, created_by,
    -- Un ajustement positif expire comme un gain ; un retrait n'expire pas.
    expires_at
  ) values (
    p_customer_id, 'adjust', 'manual', p_points, trim(p_reason), auth.uid(),
    case when p_points > 0 then public.points_expiry_at() end
  );

  perform public.write_audit(
    'loyalty.adjust', 'customers', p_customer_id::text,
    jsonb_build_object('points', p_points, 'reason', trim(p_reason), 'balance_before', v_balance)
  );

  return jsonb_build_object(
    'new_balance', (select points_balance from public.customers where id = p_customer_id)
  );
end;
$$;

-- ------------------------------------------------------------------ droits
revoke all on function public.credit_order_points(uuid)                from public;
revoke all on function public.set_order_status(uuid, public.order_status, text) from public;
revoke all on function public.credit_ticket_points(text, int, text)    from public;
revoke all on function public.adjust_points(uuid, int, text)           from public;

-- Seuls des comptes authentifiés peuvent appeler ces fonctions ; le contrôle
-- de rôle est fait à l'intérieur de chacune.
grant execute on function public.set_order_status(uuid, public.order_status, text) to authenticated;
grant execute on function public.credit_ticket_points(text, int, text)             to authenticated;
grant execute on function public.adjust_points(uuid, int, text)                    to authenticated;

-- ------------------------------------------------------------------------ RLS
alter table public.loyalty_transactions enable row level security;

create policy loyalty_read_self on public.loyalty_transactions for select
  using (exists (
    select 1 from public.customers c
    where c.id = loyalty_transactions.customer_id and c.auth_user_id = auth.uid()
  ));

create policy loyalty_read_staff on public.loyalty_transactions for select
  using (public.is_staff());

-- Aucune policy insert, update ou delete. Ni un client, ni un caissier, ni
-- un superadmin ne peut écrire une ligne de points autrement que par les
-- fonctions ci-dessus. Le ledger n'est jamais modifié après coup.

-- ─── 006_seed_menu.sql ───────────────────────────────────────────────

-- =============================================================================
-- Easy Burger — 006_seed_menu
-- -----------------------------------------------------------------------------
-- Le menu réel du §5. Prix en centimes entiers.
--
-- ⚠️  LES PRIX SONT À VÉRIFIER AVANT MISE EN LIGNE (§5). Ils viennent du
--    brief, pas de la caisse. Une fois vérifiés, ils se modifient depuis
--    /admin — cette migration ne sert qu'à l'amorçage.
--
-- Les produits sans photo affichent un placeholder « photo à venir » au bon
-- ratio : le passage aux vraies photos est un simple remplacement de fichier.
-- =============================================================================

insert into public.restaurants (name, address, phone, is_open)
values ('Easy Burger', 'Casablanca', null, true)
on conflict do nothing;

-- ---------------------------------------------------------------- catégories
insert into public.categories (slug, name, sort_order) values
  ('smash-burgers', 'Smash burgers', 10),
  ('salad-sides',   'Salad & sides', 20),
  ('desserts',      'Desserts',      30),
  ('drinks',        'Drinks',        40)
on conflict (slug) do nothing;

-- ------------------------------------------------------------------ produits
insert into public.products
  (category_id, slug, name, description, price_cents, image_url, sort_order, is_featured)
values
  -- SMASH BURGERS
  ((select id from public.categories where slug = 'smash-burgers'),
   'cheeseburger', 'Cheeseburger',
   'Steak smashé, cheddar, pickles, sauce maison', 6000,
   '/photos/cheeseburger.jpg', 10, true),

  ((select id from public.categories where slug = 'smash-burgers'),
   'double-cheeseburger', 'Double cheeseburger',
   'Deux steaks smashés, double cheddar, pickles, sauce maison', 7500,
   '/photos/double-cheeseburger.jpg', 20, true),

  ((select id from public.categories where slug = 'smash-burgers'),
   'home-made-burger', 'Home made burger',
   'Le burger signature de la maison', 8000,
   '/photos/home-made-burger.jpg', 30, false),

  ((select id from public.categories where slug = 'smash-burgers'),
   'burger-du-mois', 'Burger du mois',
   'La création du mois. Demande-nous ce qu''il y a dedans.', 8000,
   null, 40, false),

  -- SALAD & SIDES
  ((select id from public.categories where slug = 'salad-sides'),
   'salade-cesar', 'Salade César sauce maison',
   null, 6000, null, 10, false),

  ((select id from public.categories where slug = 'salad-sides'),
   'frites-maison', 'Frites maison',
   null, 2500, '/photos/frites-maison.jpg', 20, false),

  ((select id from public.categories where slug = 'salad-sides'),
   'frites-patates-douces', 'Frites de patates douces',
   null, 3000, '/photos/frites-patates-douces.jpg', 30, false),

  ((select id from public.categories where slug = 'salad-sides'),
   'cheesy-frites', 'Cheesy frites',
   'Frites maison, sauce fromagère', 3000, null, 40, false),

  ((select id from public.categories where slug = 'salad-sides'),
   'cheesy-bacon-frites', 'Cheesy bacon frites',
   'Frites maison, sauce fromagère, bacon de bœuf', 5000,
   '/photos/cheesy-bacon-frites.jpg', 50, false),

  -- DESSERTS
  ((select id from public.categories where slug = 'desserts'),
   'beignets', 'Beignets',
   'Au choix : nutella, sucre ou miel', 4000, null, 10, false),

  ((select id from public.categories where slug = 'desserts'),
   'soft-serve', 'Soft serve',
   null, 4500, null, 20, false),

  -- DRINKS
  ((select id from public.categories where slug = 'drinks'),
   'soda', 'Soda', null, 2000, null, 10, false),

  ((select id from public.categories where slug = 'drinks'),
   'milkshake', 'Milkshake', null, 4500, null, 20, false)
on conflict (slug) do nothing;

-- ------------------------------------------------------------------- options
do $$
declare
  v_opt uuid;
  v_prod uuid;
  v_slug text;
begin
  -- Suppléments, communs aux quatre burgers.
  foreach v_slug in array array['cheeseburger','double-cheeseburger','home-made-burger','burger-du-mois']
  loop
    select id into v_prod from public.products where slug = v_slug;

    insert into public.product_options (product_id, name, type, is_required, sort_order)
    values (v_prod, 'Suppléments', 'multi', false, 10)
    returning id into v_opt;

    insert into public.product_option_values (option_id, name, price_delta_cents, sort_order) values
      (v_opt, 'Sauce maison supplémentaire', 1200, 10),
      (v_opt, 'Cheddar supplémentaire',      1000, 20),
      (v_opt, 'Bacon de bœuf',               1500, 30),
      (v_opt, 'Steak supplémentaire',        2500, 40);

    insert into public.product_options (product_id, name, type, is_required, sort_order)
    values (v_prod, 'Sans', 'multi', false, 20)
    returning id into v_opt;

    insert into public.product_option_values (option_id, name, price_delta_cents, sort_order) values
      (v_opt, 'Sans oignons',  0, 10),
      (v_opt, 'Sans pickles',  0, 20),
      (v_opt, 'Sans sauce',    0, 30);
  end loop;

  -- Beignets : le parfum est un choix obligatoire, sans supplément.
  select id into v_prod from public.products where slug = 'beignets';
  insert into public.product_options (product_id, name, type, is_required, sort_order)
  values (v_prod, 'Parfum', 'single', true, 10)
  returning id into v_opt;
  insert into public.product_option_values (option_id, name, price_delta_cents, sort_order) values
    (v_opt, 'Nutella', 0, 10),
    (v_opt, 'Sucre',   0, 20),
    (v_opt, 'Miel',    0, 30);

  select id into v_prod from public.products where slug = 'soft-serve';
  insert into public.product_options (product_id, name, type, is_required, sort_order)
  values (v_prod, 'Parfum', 'single', true, 10)
  returning id into v_opt;
  insert into public.product_option_values (option_id, name, price_delta_cents, sort_order) values
    (v_opt, 'Vanille',  0, 10),
    (v_opt, 'Chocolat', 0, 20);

  select id into v_prod from public.products where slug = 'milkshake';
  insert into public.product_options (product_id, name, type, is_required, sort_order)
  values (v_prod, 'Parfum', 'single', true, 10)
  returning id into v_opt;
  insert into public.product_option_values (option_id, name, price_delta_cents, sort_order) values
    (v_opt, 'Vanille',  0, 10),
    (v_opt, 'Chocolat', 0, 20),
    (v_opt, 'Fraise',   0, 30),
    (v_opt, 'Oreo',     0, 40);

  select id into v_prod from public.products where slug = 'soda';
  insert into public.product_options (product_id, name, type, is_required, sort_order)
  values (v_prod, 'Boisson', 'single', true, 10)
  returning id into v_opt;
  insert into public.product_option_values (option_id, name, price_delta_cents, sort_order) values
    (v_opt, 'Coca',      0, 10),
    (v_opt, 'Coca zéro', 0, 20),
    (v_opt, 'Fanta',     0, 30),
    (v_opt, 'Sprite',    0, 40),
    (v_opt, 'Eau',       0, 50);
end;
$$;

-- ─── 007_auth.sql ───────────────────────────────────────────────

-- =============================================================================
-- Easy Burger — 007_auth
-- -----------------------------------------------------------------------------
-- Le client obtient une vraie session (téléphone + OTP). Ce qui n'était pas
-- atteignable en Phase 1 le devient : il faut donc verrouiller ce qu'un
-- client authentifié peut écrire sur sa propre fiche.
-- =============================================================================

-- ============================ correctif de sécurité ==========================
-- La policy `customers_update_self` (003) filtre les LIGNES, pas les COLONNES.
-- Tant qu'aucun client n'avait de session, personne ne pouvait s'en servir.
-- Avec l'auth par OTP, un client pourrait écrire directement
-- `points_balance = 999999` sur sa propre fiche via l'API REST.
--
-- RLS ne sait pas restreindre une colonne : c'est le rôle des GRANT.
-- On retire donc le droit d'update global et on ne rend que les champs de
-- profil. Les soldes et compteurs restent inaccessibles en écriture, y
-- compris à leur propriétaire.
revoke update on public.customers from authenticated;
revoke update on public.customers from anon;

grant update (first_name, last_name, email, birthdate, marketing_consent, consent_at)
  on public.customers to authenticated;

-- Même logique pour le ledger. Il n'a aucune policy d'écriture, donc RLS
-- suffit aujourd'hui — mais une policy permissive ajoutée par distraction
-- dans six mois rouvrirait la porte. Le retrait du droit la garde fermée
-- quoi qu'il arrive aux policies. Les fonctions `security definer`
-- s'exécutent avec les droits du propriétaire : elles ne sont pas gênées.
revoke insert, update, delete on public.loyalty_transactions from anon, authenticated;

-- Une commande ne s'insère que par place_order.
revoke insert on public.orders             from anon, authenticated;
revoke insert on public.order_items        from anon, authenticated;
revoke insert on public.order_item_options from anon, authenticated;
-- =============================================================================

/**
 * Rattache le compte Supabase Auth courant à sa fiche client.
 *
 * Appelée juste après la vérification de l'OTP. Le numéro vient du jeton,
 * jamais du navigateur : un client ne peut pas se rattacher à la fiche de
 * quelqu'un d'autre en envoyant un autre numéro.
 */
create or replace function public.link_current_customer()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid       uuid := auth.uid();
  v_phone     text;
  v_customer  public.customers%rowtype;
begin
  if v_uid is null then
    raise exception 'Aucune session' using errcode = 'insufficient_privilege';
  end if;

  -- Le numéro fait autorité côté jeton. On accepte les deux emplacements :
  -- claim de premier niveau et user_metadata, selon la configuration du projet.
  v_phone := public.normalize_phone(coalesce(
    nullif(auth.jwt() ->> 'phone', ''),
    nullif(auth.jwt() #>> '{user_metadata,phone}', '')
  ));

  if v_phone is null then
    raise exception 'Le jeton ne porte pas de numéro de téléphone'
      using errcode = 'check_violation';
  end if;

  select * into v_customer from public.customers where phone = v_phone;

  if not found then
    insert into public.customers (phone, auth_user_id)
    values (v_phone, v_uid)
    returning * into v_customer;

  elsif v_customer.auth_user_id is null then
    -- Fiche créée au comptoir ou par une commande invité : on la rattache.
    update public.customers
       set auth_user_id = v_uid
     where id = v_customer.id
    returning * into v_customer;

  elsif v_customer.auth_user_id <> v_uid then
    -- Le numéro a déjà été vérifié par un autre compte Auth (réinscription,
    -- changement d'appareil). Le téléphone reste la clé d'identité : on
    -- bascule la fiche sur le compte qui vient de prouver le numéro.
    update public.customers
       set auth_user_id = v_uid
     where id = v_customer.id
    returning * into v_customer;
  end if;

  return jsonb_build_object(
    'id', v_customer.id,
    'phone', v_customer.phone,
    'first_name', v_customer.first_name,
    'points_balance', v_customer.points_balance,
    'orders_count', v_customer.orders_count
  );
end;
$$;

/**
 * §8 — « Prénom demandé après la première commande réussie, pas avant. »
 *
 * L'écran de suivi le demande une fois la commande passée. Le porteur du
 * jeton de suivi peut donc nommer le client de cette commande, et rien
 * d'autre : pas de session requise, pas d'autre champ modifiable.
 */
create or replace function public.name_customer_by_order_token(
  p_token uuid,
  p_name  text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_customer uuid;
  v_name     text := nullif(trim(p_name), '');
begin
  if v_name is null then
    raise exception 'Indique un prénom' using errcode = 'check_violation';
  end if;

  select customer_id into v_customer from public.orders where public_token = p_token;
  if v_customer is null then
    raise exception 'Commande introuvable';
  end if;

  -- On ne remplace jamais un prénom déjà connu : un lien de suivi partagé
  -- ne doit pas pouvoir renommer un client.
  update public.customers
     set first_name = v_name
   where id = v_customer
     and first_name is null;

  update public.orders
     set contact_name = coalesce(contact_name, v_name)
   where public_token = p_token;

  return jsonb_build_object('first_name', v_name);
end;
$$;

/**
 * §13 — suppression de compte accessible depuis l'app.
 *
 * Les commandes sont conservées pour la comptabilité, mais vidées de toute
 * donnée personnelle. Le ledger de points part avec la fiche client.
 */
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid      uuid := auth.uid();
  v_customer uuid;
begin
  if v_uid is null then
    raise exception 'Aucune session' using errcode = 'insufficient_privilege';
  end if;

  select id into v_customer from public.customers where auth_user_id = v_uid;
  if v_customer is null then
    return;
  end if;

  update public.orders
     set contact_name     = null,
         contact_phone    = null,
         address_snapshot = null,
         note             = null,
         customer_id      = null
   where customer_id = v_customer;

  -- Cascade : adresses et loyalty_transactions partent avec.
  delete from public.customers where id = v_customer;
  delete from auth.users where id = v_uid;
end;
$$;

revoke all on function public.link_current_customer()                     from public;
revoke all on function public.name_customer_by_order_token(uuid, text)    from public;
revoke all on function public.delete_my_account()                         from public;

grant execute on function public.link_current_customer()                  to authenticated;
grant execute on function public.name_customer_by_order_token(uuid, text) to anon, authenticated;
grant execute on function public.delete_my_account()                      to authenticated;

/**
 * L'écran de suivi doit savoir s'il faut demander le prénom (§8). On
 * enrichit le retour existant plutôt que d'ajouter un aller-retour.
 */
create or replace function public.get_order_by_token(p_token uuid)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'order_number', o.order_number,
    'status', o.status,
    'mode', o.mode,
    'placed_at', o.placed_at,
    'subtotal_cents', o.subtotal_cents,
    'delivery_fee_cents', o.delivery_fee_cents,
    'total_cents', o.total_cents,
    'contact_name', o.contact_name,
    'address_snapshot', o.address_snapshot,
    'note', o.note,
    -- Vrai tant que le client n'a pas de prénom : le suivi le demande alors.
    'needs_name', (c.id is not null and c.first_name is null),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'name', i.name_snapshot,
        'qty', i.qty,
        'line_total_cents', i.line_total_cents,
        'options', coalesce((
          select jsonb_agg(op.name_snapshot order by op.name_snapshot)
          from public.order_item_options op where op.order_item_id = i.id
        ), '[]'::jsonb)
      ) order by i.name_snapshot)
      from public.order_items i where i.order_id = o.id
    ), '[]'::jsonb)
  )
  from public.orders o
  left join public.customers c on c.id = o.customer_id
  where o.public_token = p_token;
$$;

revoke all on function public.get_order_by_token(uuid) from public;
grant execute on function public.get_order_by_token(uuid) to anon, authenticated;

-- ─── 008_rewards.sql ───────────────────────────────────────────────

-- =============================================================================
-- Easy Burger — 008_rewards
-- -----------------------------------------------------------------------------
-- §6.2 la boutique, §6.3 bienvenue / anniversaire / expiration,
-- §6.5 le code à 6 chiffres à usage unique.
--
-- Deux principes, comme pour le reste du ledger :
--   — aucune écriture de points depuis le client ;
--   — ce qui doit être unique l'est par contrainte, pas par vérification.
-- =============================================================================

create table public.rewards (
  id              uuid primary key default gen_random_uuid(),
  slug            text not null unique,
  title           text not null,
  description     text,
  image_url       text,
  points_cost     int  not null check (points_cost >= 0),
  -- Produit offert, quand la récompense en désigne un.
  product_id      uuid references public.products (id) on delete set null,
  min_order_cents int  not null default 0,
  -- Nombre de fois qu'un même client peut l'obtenir. null = sans limite.
  max_per_customer int,
  valid_from      timestamptz,
  valid_to        timestamptz,
  is_active       boolean not null default true,
  sort_order      int not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create trigger rewards_touch_updated_at
  before update on public.rewards
  for each row execute function public.touch_updated_at();

create type public.redemption_status as enum ('issued', 'used', 'expired', 'cancelled');

create table public.reward_redemptions (
  id          uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers (id) on delete cascade,
  reward_id   uuid not null references public.rewards (id) on delete restrict,
  order_id    uuid references public.orders (id) on delete set null,
  -- §6.5 : 6 chiffres, valable 15 minutes, à usage unique.
  code        text not null check (code ~ '^[0-9]{6}$'),
  status      public.redemption_status not null default 'issued',
  points_spent int not null default 0,
  issued_at   timestamptz not null default now(),
  used_at     timestamptz,
  used_by     uuid references auth.users (id) on delete set null,
  expires_at  timestamptz not null
);

create index reward_redemptions_customer_idx
  on public.reward_redemptions (customer_id, issued_at desc);

-- Deux codes identiques ne peuvent pas être valides en même temps : sans ça,
-- un caissier qui tape « 408271 » ne saurait pas laquelle des deux consommer.
create unique index reward_redemptions_active_code_idx
  on public.reward_redemptions (code)
  where status = 'issued';

comment on index public.reward_redemptions_active_code_idx is
  'Un code à 6 chiffres ne désigne jamais deux récompenses en attente.';

-- ------------------------------------------------------------------ boutique
insert into public.rewards (slug, title, points_cost, product_id, sort_order) values
  ('sauce-maison',        'Sauce maison supplémentaire', 120,
    null, 10),
  ('soda',                'Soda',                        200,
    (select id from public.products where slug = 'soda'), 20),
  ('frites-maison',       'Frites maison',               250,
    (select id from public.products where slug = 'frites-maison'), 30),
  ('beignets-nutella',    'Beignets nutella',            400,
    (select id from public.products where slug = 'beignets'), 40),
  ('milkshake',           'Milkshake ou soft serve',     450,
    (select id from public.products where slug = 'milkshake'), 50),
  ('cheeseburger',        'Cheeseburger',                600,
    (select id from public.products where slug = 'cheeseburger'), 60),
  ('double-cheeseburger', 'Double cheeseburger',         750,
    (select id from public.products where slug = 'double-cheeseburger'), 70)
on conflict (slug) do nothing;

-- Récompenses offertes, hors boutique : elles coûtent 0 point et ne sont pas
-- échangeables librement — seules les fonctions ci-dessous les délivrent.
insert into public.rewards (slug, title, points_cost, product_id, is_active, sort_order) values
  ('bienvenue',    'Frites maison offertes', 0,
    (select id from public.products where slug = 'frites-maison'), false, 100),
  ('anniversaire', 'Dessert offert',         0,
    (select id from public.products where slug = 'beignets'), false, 110)
on conflict (slug) do nothing;

-- ------------------------------------------------------------- génération du code
/**
 * Un code à 6 chiffres qui n'est pas déjà en attente.
 *
 * On tire au hasard plutôt que d'incrémenter : un code séquentiel se devine,
 * et 15 minutes suffisent à quelqu'un de motivé pour essayer les voisins.
 */
create or replace function public.new_redemption_code()
returns text
language plpgsql
as $$
declare
  v_code text;
  v_try  int := 0;
begin
  loop
    v_code := lpad((floor(random() * 1000000))::int::text, 6, '0');
    exit when not exists (
      select 1 from public.reward_redemptions
      where code = v_code and status = 'issued'
    );
    v_try := v_try + 1;
    if v_try > 50 then
      raise exception 'Impossible de générer un code libre';
    end if;
  end loop;
  return v_code;
end;
$$;

/** Durée de validité d'un code, en minutes (§6.5). */
create or replace function public.redemption_ttl_minutes()
returns int
language sql
stable
as $$
  select coalesce(
    (select (value #>> '{}')::int from public.settings where key = 'redemption_code_ttl_minutes'),
    15
  );
$$;

insert into public.settings (key, value, label, is_public) values
  ('redemption_code_ttl_minutes', to_jsonb(15),
   'Durée de validité d''un code de récompense, en minutes (§6.5)', true)
on conflict (key) do nothing;

-- =============================================================================
-- Échange de points contre une récompense
-- =============================================================================
create or replace function public.redeem_reward(p_reward_slug text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_customer public.customers%rowtype;
  v_reward   public.rewards%rowtype;
  v_code     text;
  v_id       uuid;
  v_used     int;
begin
  select * into v_customer from public.customers where auth_user_id = auth.uid();
  if not found then
    raise exception 'Connecte-toi pour utiliser une récompense'
      using errcode = 'insufficient_privilege';
  end if;

  select * into v_reward from public.rewards where slug = p_reward_slug;
  if not found or not v_reward.is_active then
    raise exception 'Cette récompense n''est pas disponible'
      using errcode = 'check_violation';
  end if;

  if (v_reward.valid_from is not null and now() < v_reward.valid_from)
     or (v_reward.valid_to is not null and now() > v_reward.valid_to) then
    raise exception 'Cette récompense n''est pas disponible en ce moment'
      using errcode = 'check_violation';
  end if;

  if v_reward.max_per_customer is not null then
    select count(*) into v_used
      from public.reward_redemptions
     where customer_id = v_customer.id
       and reward_id = v_reward.id
       and status in ('issued', 'used');
    if v_used >= v_reward.max_per_customer then
      raise exception 'Tu as déjà utilisé cette récompense'
        using errcode = 'check_violation';
    end if;
  end if;

  if v_customer.points_balance < v_reward.points_cost then
    raise exception 'Il te manque % points', v_reward.points_cost - v_customer.points_balance
      using errcode = 'check_violation';
  end if;

  -- Un seul code en attente à la fois : deux codes simultanés, c'est le
  -- caissier qui se trompe et le client qui perd ses points.
  if exists (
    select 1 from public.reward_redemptions
     where customer_id = v_customer.id
       and status = 'issued'
       and expires_at > now()
  ) then
    raise exception 'Tu as déjà un code en cours. Utilise-le ou attends qu''il expire.'
      using errcode = 'check_violation';
  end if;

  v_code := public.new_redemption_code();

  insert into public.reward_redemptions (
    customer_id, reward_id, code, points_spent, expires_at
  ) values (
    v_customer.id, v_reward.id, v_code, v_reward.points_cost,
    now() + make_interval(mins => public.redemption_ttl_minutes())
  )
  returning id into v_id;

  -- Débit des points. source_ref = l'échange : un même échange ne peut pas
  -- débiter deux fois.
  if v_reward.points_cost > 0 then
    insert into public.loyalty_transactions (
      customer_id, type, source, source_ref, points, note
    ) values (
      v_customer.id, 'redeem', 'reward', v_id::text,
      -v_reward.points_cost, v_reward.title
    );
  end if;

  return jsonb_build_object(
    'id', v_id,
    'code', v_code,
    'title', v_reward.title,
    'expires_at', (select expires_at from public.reward_redemptions where id = v_id),
    'new_balance', (select points_balance from public.customers where id = v_customer.id)
  );
end;
$$;

-- =============================================================================
-- Consommation du code au comptoir
-- =============================================================================
create or replace function public.consume_reward_code(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_red   public.reward_redemptions%rowtype;
  v_title text;
  v_phone text;
begin
  if not public.is_at_least('cashier') then
    raise exception 'Accès refusé' using errcode = 'insufficient_privilege';
  end if;

  select * into v_red
    from public.reward_redemptions
   where code = regexp_replace(coalesce(p_code, ''), '\D', '', 'g')
     and status = 'issued'
   for update;

  if not found then
    raise exception 'Code inconnu ou déjà utilisé' using errcode = 'no_data_found';
  end if;

  if v_red.expires_at <= now() then
    raise exception 'Code expiré. Le client peut en redemander un.'
      using errcode = 'check_violation';
  end if;

  update public.reward_redemptions
     set status = 'used', used_at = now(), used_by = auth.uid()
   where id = v_red.id;

  select r.title into v_title from public.rewards r where r.id = v_red.reward_id;
  select c.phone into v_phone from public.customers c where c.id = v_red.customer_id;

  perform public.write_audit(
    'reward.consume', 'reward_redemptions', v_red.id::text,
    jsonb_build_object('code', v_red.code, 'title', v_title)
  );

  return jsonb_build_object('title', v_title, 'phone', v_phone);
end;
$$;

-- =============================================================================
-- Codes expirés : les points reviennent au client
-- -----------------------------------------------------------------------------
-- Le brief ne dit pas ce qu'il advient d'un code non utilisé. Ne rien faire
-- reviendrait à confisquer des points pour un client qui a simplement changé
-- d'avis ou n'a pas eu le temps — la pire manière de perdre quelqu'un qu'on
-- vient de récompenser. On rembourse, et le mouvement reste tracé.
-- =============================================================================
create or replace function public.expire_reward_codes()
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_red   record;
  v_count int := 0;
begin
  for v_red in
    select * from public.reward_redemptions
     where status = 'issued' and expires_at <= now()
     for update
  loop
    update public.reward_redemptions set status = 'expired' where id = v_red.id;

    if v_red.points_spent > 0 then
      insert into public.loyalty_transactions (
        customer_id, type, source, source_ref, points, note, expires_at
      ) values (
        v_red.customer_id, 'adjust', 'reward', v_red.id::text || ':refund',
        v_red.points_spent, 'Code non utilisé — points rendus',
        public.points_expiry_at()
      );
    end if;

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

-- ------------------------------------------------------------------------ RLS
alter table public.rewards            enable row level security;
alter table public.reward_redemptions enable row level security;

create policy rewards_read_all on public.rewards for select
  using (is_active or public.is_staff());

create policy rewards_write_admin on public.rewards for all
  using (public.is_at_least('admin')) with check (public.is_at_least('admin'));

create policy redemptions_read_self on public.reward_redemptions for select
  using (exists (
    select 1 from public.customers c
    where c.id = reward_redemptions.customer_id and c.auth_user_id = auth.uid()
  ));

create policy redemptions_read_staff on public.reward_redemptions for select
  using (public.is_staff());

-- Aucune policy d'écriture : tout passe par les fonctions ci-dessus.
revoke insert, update, delete on public.reward_redemptions from anon, authenticated;

revoke all on function public.redeem_reward(text)      from public;
revoke all on function public.consume_reward_code(text) from public;
revoke all on function public.expire_reward_codes()     from public;

grant execute on function public.redeem_reward(text)       to authenticated;
grant execute on function public.consume_reward_code(text) to authenticated;

-- ─── 009_gifts_and_expiry.sql ───────────────────────────────────────────────

-- =============================================================================
-- Easy Burger — 009_gifts_and_expiry
-- -----------------------------------------------------------------------------
-- §6.3 : bienvenue, anniversaire, expiration des points en FIFO.
-- =============================================================================

-- Les récompenses offertes ne se limitent pas de la même façon : la bienvenue
-- est une fois par numéro, l'anniversaire une fois par an. Une clé d'octroi
-- portée par une contrainte d'unicité dit laquelle, sans code applicatif.
alter table public.reward_redemptions add column grant_key text;

create unique index reward_redemptions_grant_key_idx
  on public.reward_redemptions (grant_key)
  where grant_key is not null;

comment on column public.reward_redemptions.grant_key is
  'Clé d''unicité d''un cadeau : « welcome:<client> », « birthday:<client>:<année> ». '
  'C''est la contrainte qui empêche l''octroi en double, pas une vérification.';

-- La règle « un seul code en attente » ne vaut que pour les échanges de
-- points : un cadeau en poche ne doit pas empêcher d'utiliser ses points.
create or replace function public.redeem_reward(p_reward_slug text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_customer public.customers%rowtype;
  v_reward   public.rewards%rowtype;
  v_code     text;
  v_id       uuid;
  v_used     int;
begin
  select * into v_customer from public.customers where auth_user_id = auth.uid();
  if not found then
    raise exception 'Connecte-toi pour utiliser une récompense'
      using errcode = 'insufficient_privilege';
  end if;

  select * into v_reward from public.rewards where slug = p_reward_slug;
  if not found or not v_reward.is_active then
    raise exception 'Cette récompense n''est pas disponible'
      using errcode = 'check_violation';
  end if;

  if (v_reward.valid_from is not null and now() < v_reward.valid_from)
     or (v_reward.valid_to is not null and now() > v_reward.valid_to) then
    raise exception 'Cette récompense n''est pas disponible en ce moment'
      using errcode = 'check_violation';
  end if;

  if v_reward.max_per_customer is not null then
    select count(*) into v_used
      from public.reward_redemptions
     where customer_id = v_customer.id
       and reward_id = v_reward.id
       and status in ('issued', 'used');
    if v_used >= v_reward.max_per_customer then
      raise exception 'Tu as déjà utilisé cette récompense'
        using errcode = 'check_violation';
    end if;
  end if;

  if exists (
    select 1 from public.reward_redemptions
     where customer_id = v_customer.id
       and status = 'issued'
       and points_spent > 0
       and expires_at > now()
  ) then
    raise exception 'Tu as déjà un code en cours. Utilise-le ou attends qu''il expire.'
      using errcode = 'check_violation';
  end if;

  if v_customer.points_balance < v_reward.points_cost then
    raise exception 'Il te manque % points', v_reward.points_cost - v_customer.points_balance
      using errcode = 'check_violation';
  end if;

  v_code := public.new_redemption_code();

  insert into public.reward_redemptions (
    customer_id, reward_id, code, points_spent, expires_at
  ) values (
    v_customer.id, v_reward.id, v_code, v_reward.points_cost,
    now() + make_interval(mins => public.redemption_ttl_minutes())
  )
  returning id into v_id;

  if v_reward.points_cost > 0 then
    insert into public.loyalty_transactions (
      customer_id, type, source, source_ref, points, note
    ) values (
      v_customer.id, 'redeem', 'reward', v_id::text,
      -v_reward.points_cost, v_reward.title
    );
  end if;

  return jsonb_build_object(
    'id', v_id,
    'code', v_code,
    'title', v_reward.title,
    'expires_at', (select expires_at from public.reward_redemptions where id = v_id),
    'new_balance', (select points_balance from public.customers where id = v_customer.id)
  );
end;
$$;

-- =============================================================================
-- Cadeau : bienvenue et anniversaire
-- =============================================================================
/**
 * Octroie une récompense offerte, sans débit de points.
 * `p_grant_key` porte l'unicité : un second appel est simplement ignoré.
 * Renvoie l'identifiant de l'octroi, ou null s'il existait déjà.
 */
create or replace function public.grant_gift(
  p_customer_id uuid,
  p_reward_slug text,
  p_grant_key   text,
  p_valid_days  int
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_reward_id uuid;
  v_id        uuid;
begin
  select id into v_reward_id from public.rewards where slug = p_reward_slug;
  if v_reward_id is null then
    return null;
  end if;

  begin
    insert into public.reward_redemptions (
      customer_id, reward_id, code, points_spent, expires_at, grant_key
    ) values (
      p_customer_id, v_reward_id, public.new_redemption_code(), 0,
      now() + make_interval(days => p_valid_days), p_grant_key
    )
    returning id into v_id;
  exception when unique_violation then
    -- Déjà offert. Ce n'est pas une erreur, c'est le comportement voulu.
    return null;
  end;

  return v_id;
end;
$$;

/**
 * §6.3 — frites maison offertes à la première commande ≥ 70 MAD,
 * une seule fois par numéro de téléphone.
 *
 * Le verrou porte sur le client, et un client EST un numéro (contrainte
 * d'unicité sur `phone`) : se réinscrire avec un autre compte Auth ne redonne
 * pas l'offre.
 */
create or replace function public.maybe_grant_welcome(p_order_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order   public.orders%rowtype;
  v_enabled boolean;
  v_min     int;
begin
  select * into v_order from public.orders where id = p_order_id;
  if not found or v_order.customer_id is null then
    return null;
  end if;

  select coalesce((value #>> '{}')::boolean, true) into v_enabled
    from public.settings where key = 'welcome_reward_enabled';
  if v_enabled is not true then
    return null;
  end if;

  select coalesce((value #>> '{}')::int, 7000) into v_min
    from public.settings where key = 'welcome_min_order_cents';

  if v_order.subtotal_cents < v_min then
    return null;
  end if;

  return public.grant_gift(
    v_order.customer_id, 'bienvenue',
    'welcome:' || v_order.customer_id::text,
    30
  );
end;
$$;

/**
 * §6.3 — un dessert offert, valable 7 jours autour de la date de naissance.
 * À passer une fois par jour.
 */
create or replace function public.grant_birthday_rewards()
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_row   record;
  v_count int := 0;
  v_id    uuid;
begin
  for v_row in
    select id, birthdate
      from public.customers
     where birthdate is not null
       -- Fenêtre de 7 jours centrée sur la date : on offre 3 jours avant.
       and (
         to_char(birthdate, 'MM-DD') = to_char(current_date + 3, 'MM-DD')
       )
  loop
    v_id := public.grant_gift(
      v_row.id, 'anniversaire',
      'birthday:' || v_row.id::text || ':' || to_char(current_date, 'YYYY'),
      7
    );
    if v_id is not null then
      v_count := v_count + 1;
    end if;
  end loop;

  return v_count;
end;
$$;

-- Le crédit d'une commande terminée déclenche l'offre de bienvenue.
create or replace function public.set_order_status(
  p_order_id uuid,
  p_status   public.order_status,
  p_reason   text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order   public.orders%rowtype;
  v_points  int := 0;
  v_welcome uuid;
begin
  if not public.is_at_least('cashier') then
    raise exception 'Accès refusé' using errcode = 'insufficient_privilege';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'Commande introuvable';
  end if;

  if v_order.status = p_status then
    return jsonb_build_object('status', p_status, 'points_credited', 0);
  end if;

  update public.orders
     set status        = p_status,
         completed_at  = case when p_status = 'completed' then now() else completed_at end,
         cancelled_at  = case when p_status = 'cancelled' then now() else cancelled_at end,
         cancel_reason = case when p_status = 'cancelled' then p_reason else cancel_reason end,
         payment_status = case
                            when p_status = 'completed' and payment_method = 'cash'
                            then 'paid'::public.payment_status
                            else payment_status
                          end
   where id = p_order_id;

  if p_status = 'completed' then
    v_points := public.credit_order_points(p_order_id);

    if v_order.completed_at is null then
      update public.customers c
         set orders_count   = c.orders_count + 1,
             lifetime_spend = c.lifetime_spend + v_order.total_cents,
             last_order_at  = now()
       where c.id = v_order.customer_id;

      -- §6.3 : l'offre de bienvenue ne se déclenche qu'à la première
      -- commande réellement terminée.
      v_welcome := public.maybe_grant_welcome(p_order_id);
    end if;
  end if;

  perform public.write_audit(
    'order.status', 'orders', p_order_id::text,
    jsonb_build_object('from', v_order.status, 'to', p_status, 'points', v_points, 'reason', p_reason)
  );

  return jsonb_build_object(
    'status', p_status,
    'points_credited', v_points,
    'welcome_granted', v_welcome is not null
  );
end;
$$;

-- =============================================================================
-- Expiration des points, en FIFO (§6.3)
-- -----------------------------------------------------------------------------
-- Les points expirent 12 mois après leur acquisition, et la consommation est
-- FIFO : ce sont toujours les plus anciens qui partent d'abord. Un lot n'expire
-- donc que pour sa part non consommée.
--
-- L'unicité par (source, source_ref) du ledger garantit qu'un même lot ne peut
-- pas être expiré deux fois, même si le job tourne en double.
-- =============================================================================
create or replace function public.expire_points()
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_cust      record;
  v_lot       record;
  v_spent     bigint;
  v_remaining bigint;
  v_expired   int := 0;
begin
  for v_cust in
    select distinct customer_id
      from public.loyalty_transactions
     where points > 0
       and expires_at is not null
       and expires_at <= now()
  loop
    -- Tout ce qui a été dépensé, quelle qu'en soit la raison.
    select coalesce(-sum(points), 0) into v_spent
      from public.loyalty_transactions
     where customer_id = v_cust.customer_id and points < 0;

    -- On rejoue les lots du plus ancien au plus récent et on épuise la
    -- dépense au fur et à mesure.
    for v_lot in
      select id, points, expires_at, created_at
        from public.loyalty_transactions
       where customer_id = v_cust.customer_id and points > 0
       order by created_at, id
    loop
      if v_spent >= v_lot.points then
        v_spent := v_spent - v_lot.points;
        continue;                       -- lot entièrement consommé
      end if;

      v_remaining := v_lot.points - v_spent;
      v_spent := 0;

      if v_lot.expires_at is null or v_lot.expires_at > now() then
        continue;                       -- pas encore échu
      end if;

      begin
        insert into public.loyalty_transactions (
          customer_id, type, source, source_ref, points, note
        ) values (
          v_cust.customer_id, 'expire', 'expiry', v_lot.id::text,
          -v_remaining, 'Points expirés'
        );
        v_expired := v_expired + 1;
      exception when unique_violation then
        null;                           -- lot déjà expiré
      end;
    end loop;
  end loop;

  return v_expired;
end;
$$;

/**
 * §6.3 — alerte 30 jours avant l'expiration d'un lot.
 * Renvoie de quoi alimenter la file de messages (Phase 7).
 */
create or replace function public.points_expiring_soon(p_days int default 30)
returns table (customer_id uuid, phone text, points bigint, expires_on date)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select t.customer_id,
         c.phone,
         sum(t.points) as points,
         t.expires_at::date as expires_on
    from public.loyalty_transactions t
    join public.customers c on c.id = t.customer_id
   where t.points > 0
     and t.expires_at is not null
     and t.expires_at::date = (current_date + p_days)
     and c.points_balance > 0
   group by t.customer_id, c.phone, t.expires_at::date;
$$;

revoke all on function public.grant_gift(uuid, text, text, int)   from public;
revoke all on function public.maybe_grant_welcome(uuid)           from public;
revoke all on function public.grant_birthday_rewards()            from public;
revoke all on function public.expire_points()                     from public;
revoke all on function public.points_expiring_soon(int)           from public;

-- ─── 010_glovo_and_pos.sql ───────────────────────────────────────────────

-- =============================================================================
-- Easy Burger — 010_glovo_and_pos
-- -----------------------------------------------------------------------------
-- §6.4c les codes de sac Glovo, §11.3 la réclamation par ticket.
--
-- Rien ici ne dépend d'une API Lacaisse. L'import des ventes se fait par
-- fichier, ce que toute caisse sait produire. Si une API arrive un jour, elle
-- remplacera l'import sans toucher au reste.
-- =============================================================================

insert into public.settings (key, value, label, is_public) values
  ('ticket_claim_days', to_jsonb(7),
   'Fenêtre de réclamation d''un ticket, en jours (§11.3)', true)
on conflict (key) do nothing;

-- =============================================================================
-- Codes de sac Glovo — la machine à convertir les clients de la marketplace
-- =============================================================================
create type public.claim_code_status as enum ('unused', 'redeemed', 'void');

create table public.claim_codes (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,
  batch       text not null,
  points      int  not null check (points > 0),
  status      public.claim_code_status not null default 'unused',
  redeemed_by uuid references public.customers (id) on delete set null,
  redeemed_at timestamptz,
  created_at  timestamptz not null default now()
);

create index claim_codes_batch_idx on public.claim_codes (batch, status);

/**
 * Code alphanumérique de 8 caractères, sans les glyphes qu'on confond
 * (0/O, 1/I/L). Un client qui recopie un sticker à la main ne doit pas
 * échouer parce que la police est ambiguë.
 */
create or replace function public.new_claim_code()
returns text
language plpgsql
as $$
declare
  v_alphabet constant text := '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  v_code text;
  v_try  int := 0;
begin
  loop
    v_code := '';
    for i in 1..8 loop
      v_code := v_code || substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::int, 1);
    end loop;

    exit when not exists (select 1 from public.claim_codes where code = v_code);
    v_try := v_try + 1;
    if v_try > 50 then
      raise exception 'Impossible de générer un code libre';
    end if;
  end loop;
  return v_code;
end;
$$;

/** Génération d'un lot, depuis le back-office (§10). */
create or replace function public.generate_claim_codes(
  p_batch  text,
  p_count  int,
  p_points int
)
returns setof text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_code text;
begin
  if not public.is_at_least('manager') then
    raise exception 'Accès refusé' using errcode = 'insufficient_privilege';
  end if;

  if coalesce(p_count, 0) not between 1 and 2000 then
    raise exception 'Un lot compte entre 1 et 2000 codes' using errcode = 'check_violation';
  end if;

  if coalesce(p_points, 0) <= 0 then
    raise exception 'Indique un nombre de points positif' using errcode = 'check_violation';
  end if;

  for i in 1..p_count loop
    v_code := public.new_claim_code();
    insert into public.claim_codes (code, batch, points) values (v_code, trim(p_batch), p_points);
    return next v_code;
  end loop;

  perform public.write_audit(
    'claim_codes.generate', 'claim_codes', trim(p_batch),
    jsonb_build_object('count', p_count, 'points', p_points)
  );
end;
$$;

/**
 * §6.4c — le client scanne le sticker, saisit son numéro, récupère ses points.
 *
 * Appelable sans compte : le sticker est physique, il est dans le sac du
 * client. L'unicité tient au code, pas à l'identité.
 */
create or replace function public.claim_glovo_code(p_code text, p_phone text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_code     public.claim_codes%rowtype;
  v_phone    text;
  v_customer uuid;
  v_created  boolean := false;
begin
  v_phone := public.normalize_phone(p_phone);
  if v_phone is null then
    raise exception 'Numéro de téléphone inexploitable' using errcode = 'check_violation';
  end if;

  select * into v_code
    from public.claim_codes
   where code = upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'))
   for update;

  if not found then
    raise exception 'Code inconnu. Vérifie le sticker sur ton sac.'
      using errcode = 'no_data_found';
  end if;

  if v_code.status <> 'unused' then
    raise exception 'Ce code a déjà été utilisé.' using errcode = 'unique_violation';
  end if;

  select id into v_customer from public.customers where phone = v_phone;
  if not found then
    insert into public.customers (phone) values (v_phone) returning id into v_customer;
    v_created := true;
  end if;

  -- L'unicité par (source, source_ref) fait le reste : même si deux requêtes
  -- passaient le verrou, la seconde échouerait ici.
  insert into public.loyalty_transactions (
    customer_id, type, source, source_ref, points, expires_at, note
  ) values (
    v_customer, 'bonus', 'glovo_code', v_code.code, v_code.points,
    public.points_expiry_at(), 'Code sac ' || v_code.batch
  );

  update public.claim_codes
     set status = 'redeemed', redeemed_by = v_customer, redeemed_at = now()
   where id = v_code.id;

  return jsonb_build_object(
    'points', v_code.points,
    'phone', v_phone,
    'customer_created', v_created,
    'new_balance', (select points_balance from public.customers where id = v_customer)
  );
end;
$$;

-- =============================================================================
-- §11.3 — réclamation par ticket, le filet de sécurité
-- -----------------------------------------------------------------------------
-- Pour le client qui a oublié de donner son numéro au comptoir. Il saisit le
-- numéro de ticket, le montant et la date ; le crédit part en attente. Chaque
-- nuit, l'export des ventes est importé et rapproché.
-- =============================================================================
create table public.pos_tickets (
  id           uuid primary key default gen_random_uuid(),
  ticket_ref   text not null unique,
  amount_cents int  not null check (amount_cents >= 0),
  ticket_date  date not null,
  source       text not null default 'import',
  imported_at  timestamptz not null default now()
);

create index pos_tickets_date_idx on public.pos_tickets (ticket_date);

create type public.pos_claim_status as enum ('pending', 'matched', 'rejected');

create table public.pos_claims (
  id                uuid primary key default gen_random_uuid(),
  customer_id       uuid not null references public.customers (id) on delete cascade,
  ticket_ref        text not null,
  amount_cents      int  not null check (amount_cents > 0),
  ticket_date       date not null,
  status            public.pos_claim_status not null default 'pending',
  matched_ticket_id uuid references public.pos_tickets (id) on delete set null,
  reject_reason     text,
  created_at        timestamptz not null default now(),
  resolved_at       timestamptz
);

-- §11.3 : « un ticket ne peut être réclamé qu'une seule fois ». La contrainte
-- couvre aussi les réclamations en attente : deux clients ne peuvent pas
-- réclamer le même ticket en espérant que l'un des deux passe.
create unique index pos_claims_one_per_ticket_idx
  on public.pos_claims (ticket_ref)
  where status in ('pending', 'matched');

create index pos_claims_customer_idx on public.pos_claims (customer_id, created_at desc);

/** Normalisation commune : « A-1042 », « a 1042 » et « A1042 » sont un seul ticket. */
create or replace function public.normalize_ticket_ref(raw text)
returns text
language sql
immutable
as $$
  select nullif(upper(regexp_replace(coalesce(raw, ''), '[^A-Za-z0-9]', '', 'g')), '');
$$;

/** Le client réclame un ticket. Le crédit reste en attente jusqu'au rapprochement. */
create or replace function public.submit_pos_claim(
  p_ticket_ref   text,
  p_amount_cents int,
  p_ticket_date  date
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_customer public.customers%rowtype;
  v_ref      text;
  v_days     int;
  v_id       uuid;
begin
  select * into v_customer from public.customers where auth_user_id = auth.uid();
  if not found then
    raise exception 'Connecte-toi pour réclamer un ticket'
      using errcode = 'insufficient_privilege';
  end if;

  v_ref := public.normalize_ticket_ref(p_ticket_ref);
  if v_ref is null then
    raise exception 'Indique le numéro du ticket' using errcode = 'check_violation';
  end if;

  if coalesce(p_amount_cents, 0) <= 0 then
    raise exception 'Indique le montant du ticket' using errcode = 'check_violation';
  end if;

  select coalesce((value #>> '{}')::int, 7) into v_days
    from public.settings where key = 'ticket_claim_days';

  if p_ticket_date is null
     or p_ticket_date > current_date
     or p_ticket_date < current_date - v_days then
    raise exception 'Un ticket se réclame dans les % jours qui suivent l''achat', v_days
      using errcode = 'check_violation';
  end if;

  -- Le ticket a peut-être déjà été crédité au comptoir : inutile de faire
  -- patienter le client jusqu'à la nuit pour lui dire non.
  if exists (
    select 1 from public.loyalty_transactions
     where source = 'pos_ticket' and source_ref = v_ref
  ) then
    raise exception 'Ce ticket a déjà été crédité.' using errcode = 'unique_violation';
  end if;

  begin
    insert into public.pos_claims (customer_id, ticket_ref, amount_cents, ticket_date)
    values (v_customer.id, v_ref, p_amount_cents, p_ticket_date)
    returning id into v_id;
  exception when unique_violation then
    raise exception 'Ce ticket a déjà été réclamé.' using errcode = 'unique_violation';
  end;

  return jsonb_build_object('id', v_id, 'ticket_ref', v_ref, 'status', 'pending');
end;
$$;

/** Import de l'export de ventes. Un tableau d'objets {ref, amount_cents, date}. */
create or replace function public.import_pos_tickets(p_rows jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_row      jsonb;
  v_ref      text;
  v_inserted int := 0;
  v_skipped  int := 0;
begin
  if not public.is_at_least('manager') then
    raise exception 'Accès refusé' using errcode = 'insufficient_privilege';
  end if;

  for v_row in select * from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb))
  loop
    v_ref := public.normalize_ticket_ref(v_row->>'ref');
    if v_ref is null then
      v_skipped := v_skipped + 1;
      continue;
    end if;

    begin
      insert into public.pos_tickets (ticket_ref, amount_cents, ticket_date)
      values (v_ref, (v_row->>'amount_cents')::int, (v_row->>'date')::date);
      v_inserted := v_inserted + 1;
    exception when unique_violation or invalid_text_representation or null_value_not_allowed then
      -- Un même export réimporté ne doit pas doubler les lignes, et une
      -- ligne illisible ne doit pas faire échouer tout le fichier.
      v_skipped := v_skipped + 1;
    end;
  end loop;

  perform public.write_audit(
    'pos_tickets.import', 'pos_tickets', null,
    jsonb_build_object('inserted', v_inserted, 'skipped', v_skipped)
  );

  return jsonb_build_object('inserted', v_inserted, 'skipped', v_skipped);
end;
$$;

/**
 * Rapproche les réclamations en attente avec les tickets importés.
 * Ticket trouvé + montant correspondant + non déjà crédité → crédit confirmé.
 * Sinon → rejet motivé.
 */
create or replace function public.reconcile_pos_claims()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_claim    record;
  v_ticket   public.pos_tickets%rowtype;
  v_matched  int := 0;
  v_rejected int := 0;
  v_days     int;
begin
  select coalesce((value #>> '{}')::int, 7) into v_days
    from public.settings where key = 'ticket_claim_days';

  for v_claim in
    select * from public.pos_claims where status = 'pending' for update
  loop
    select * into v_ticket from public.pos_tickets where ticket_ref = v_claim.ticket_ref;

    if not found then
      -- Tant que la fenêtre court, l'export du jour peut encore arriver.
      if v_claim.created_at < now() - make_interval(days => v_days) then
        update public.pos_claims
           set status = 'rejected', reject_reason = 'Ticket introuvable dans les ventes',
               resolved_at = now()
         where id = v_claim.id;
        v_rejected := v_rejected + 1;
      end if;
      continue;
    end if;

    if v_ticket.amount_cents <> v_claim.amount_cents then
      update public.pos_claims
         set status = 'rejected', reject_reason = 'Le montant ne correspond pas au ticket',
             resolved_at = now()
       where id = v_claim.id;
      v_rejected := v_rejected + 1;
      continue;
    end if;

    begin
      insert into public.loyalty_transactions (
        customer_id, type, source, source_ref, points, amount_cents, expires_at, note
      ) values (
        v_claim.customer_id, 'earn', 'pos_ticket', v_claim.ticket_ref,
        public.points_for_amount(v_ticket.amount_cents), v_ticket.amount_cents,
        public.points_expiry_at(), 'Ticket réclamé'
      );
    exception when unique_violation then
      -- Le ticket a été crédité au comptoir entre-temps.
      update public.pos_claims
         set status = 'rejected', reject_reason = 'Ticket déjà crédité au comptoir',
             resolved_at = now()
       where id = v_claim.id;
      v_rejected := v_rejected + 1;
      continue;
    end;

    update public.pos_claims
       set status = 'matched', matched_ticket_id = v_ticket.id, resolved_at = now()
     where id = v_claim.id;
    v_matched := v_matched + 1;
  end loop;

  return jsonb_build_object('matched', v_matched, 'rejected', v_rejected);
end;
$$;

-- ------------------------------------------------------------------------ RLS
alter table public.claim_codes enable row level security;
alter table public.pos_tickets enable row level security;
alter table public.pos_claims  enable row level security;

create policy claim_codes_read_staff on public.claim_codes for select
  using (public.is_staff());
create policy pos_tickets_read_staff on public.pos_tickets for select
  using (public.is_staff());

create policy pos_claims_read_self on public.pos_claims for select
  using (exists (
    select 1 from public.customers c
    where c.id = pos_claims.customer_id and c.auth_user_id = auth.uid()
  ));
create policy pos_claims_read_staff on public.pos_claims for select
  using (public.is_staff());

revoke insert, update, delete on public.claim_codes from anon, authenticated;
revoke insert, update, delete on public.pos_tickets from anon, authenticated;
revoke insert, update, delete on public.pos_claims  from anon, authenticated;

revoke all on function public.generate_claim_codes(text, int, int) from public;
revoke all on function public.claim_glovo_code(text, text)         from public;
revoke all on function public.submit_pos_claim(text, int, date)    from public;
revoke all on function public.import_pos_tickets(jsonb)            from public;
revoke all on function public.reconcile_pos_claims()               from public;

grant execute on function public.generate_claim_codes(text, int, int) to authenticated;
grant execute on function public.claim_glovo_code(text, text)         to anon, authenticated;
grant execute on function public.submit_pos_claim(text, int, date)    to authenticated;
grant execute on function public.import_pos_tickets(jsonb)            to authenticated;
grant execute on function public.reconcile_pos_claims()               to authenticated;

-- ─── 011_dashboard.sql ───────────────────────────────────────────────

-- =============================================================================
-- Easy Burger — 011_dashboard
-- -----------------------------------------------------------------------------
-- §10 — le tableau de bord. Agrégé en base plutôt qu'en TypeScript : une
-- requête au lieu de huit, et les chiffres restent cohérents entre eux parce
-- qu'ils sont calculés sur le même instantané.
-- =============================================================================

create or replace function public.dashboard_stats(
  p_from date default current_date,
  p_to   date default current_date
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_from timestamptz := p_from::timestamptz;
  v_to   timestamptz := (p_to + 1)::timestamptz;
  v_res  jsonb;
begin
  if not public.is_at_least('manager') then
    raise exception 'Accès refusé' using errcode = 'insufficient_privilege';
  end if;

  select jsonb_build_object(
    'orders',        coalesce(o.orders, 0),
    'completed',     coalesce(o.completed, 0),
    'cancelled',     coalesce(o.cancelled, 0),
    'revenue_cents', coalesce(o.revenue, 0),
    -- Panier moyen sur les commandes encaissées : inclure les annulées
    -- donnerait un chiffre flatteur et faux.
    'avg_basket_cents', case when coalesce(o.completed, 0) > 0
                             then (o.revenue / o.completed)::int else 0 end,
    'delivery_share', case when coalesce(o.completed, 0) > 0
                           then round(100.0 * o.delivery / o.completed) else 0 end,

    'new_customers', coalesce(c.new_customers, 0),
    'identified_customers', coalesce(c.identified, 0),

    'points_earned',   coalesce(l.earned, 0),
    'points_redeemed', coalesce(l.redeemed, 0),
    'points_expired',  coalesce(l.expired, 0),
    -- Ce que les points utilisés ont réellement coûté en valeur menu.
    'redeemed_value_cents', coalesce(l.redeemed, 0) * 100
                            / greatest(coalesce(
                                (select (value #>> '{}')::int from public.settings
                                  where key = 'redemption_rate'), 10), 1),

    'counter_tickets', coalesce(t.tickets, 0),
    'counter_identified', coalesce(t.identified, 0),
    -- §11.2 : l'indicateur de succès du programme.
    'identification_rate', case when coalesce(t.tickets, 0) > 0
                                then round(100.0 * t.identified / t.tickets) else null end
  )
  into v_res
  from
    (select count(*) filter (where true)                          as orders,
            count(*) filter (where status = 'completed')           as completed,
            count(*) filter (where status = 'cancelled')           as cancelled,
            coalesce(sum(total_cents) filter (where status = 'completed'), 0) as revenue,
            count(*) filter (where status = 'completed' and mode = 'delivery') as delivery
       from public.orders
      where placed_at >= v_from and placed_at < v_to) o,
    (select count(*) as new_customers,
            count(*) filter (where first_name is not null) as identified
       from public.customers
      where created_at >= v_from and created_at < v_to) c,
    (select coalesce(sum(points) filter (where points > 0), 0)  as earned,
            coalesce(-sum(points) filter (where type = 'redeem'), 0) as redeemed,
            coalesce(-sum(points) filter (where type = 'expire'), 0) as expired
       from public.loyalty_transactions
      where created_at >= v_from and created_at < v_to) l,
    (select count(*) as tickets,
            count(*) filter (where exists (
              select 1 from public.loyalty_transactions lt
               where lt.source = 'pos_ticket' and lt.source_ref = pt.ticket_ref
            )) as identified
       from public.pos_tickets pt
      where pt.ticket_date >= p_from and pt.ticket_date <= p_to) t;

  return v_res;
end;
$$;

/**
 * §11.2 — le taux d'identification par caissier.
 *
 * « Le personnel oubliera de demander le numéro. » Ce tableau est ce qui
 * rend cet oubli visible, caissier par caissier.
 */
create or replace function public.cashier_stats(
  p_from date default current_date - 30,
  p_to   date default current_date
)
returns table (
  staff_id      uuid,
  name          text,
  credits       bigint,
  points        bigint,
  amount_cents  bigint,
  last_credit   timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select s.id,
         s.name,
         count(t.id),
         coalesce(sum(t.points), 0),
         coalesce(sum(t.amount_cents), 0),
         max(t.created_at)
    from public.staff_users s
    left join public.loyalty_transactions t
      on t.created_by = s.id
     and t.source = 'pos_ticket'
     and t.created_at >= p_from::timestamptz
     and t.created_at < (p_to + 1)::timestamptz
   where public.is_at_least('manager')
   group by s.id, s.name
   order by count(t.id) desc;
$$;

revoke all on function public.dashboard_stats(date, date) from public;
revoke all on function public.cashier_stats(date, date)   from public;
grant execute on function public.dashboard_stats(date, date) to authenticated;
grant execute on function public.cashier_stats(date, date)   to authenticated;

-- ─── 012_payments.sql ───────────────────────────────────────────────

-- =============================================================================
-- Easy Burger — 012_payments
-- -----------------------------------------------------------------------------
-- §12 — trois règles, et elles tiennent toutes ici :
--
--   1. On ne stocke JAMAIS un numéro de carte. Seulement un jeton renvoyé
--      par le prestataire. Aucune donnée carte ne transite par cette base.
--   2. Le statut de paiement est confirmé par callback serveur, jamais par
--      le retour navigateur du client — celui-ci se falsifie d'un clic.
--   3. Toute commande a un état de paiement explicite et récupérable en cas
--      d'interruption.
-- =============================================================================

create type public.payment_event_status as enum (
  'created',    -- intention enregistrée, client envoyé chez le prestataire
  'authorized', -- autorisé, pas encore capturé
  'paid',
  'failed',
  'refunded',
  'expired'
);

create table public.payments (
  id            uuid primary key default gen_random_uuid(),
  order_id      uuid not null references public.orders (id) on delete cascade,
  -- Nom du prestataire. Le code métier ne le lit jamais : il ne sert qu'au
  -- routage du callback et au support.
  provider      text not null,
  -- Référence côté prestataire. Unique par prestataire : un même callback
  -- rejoué ne crée pas une seconde ligne.
  provider_ref  text,
  status        public.payment_event_status not null default 'created',
  amount_cents  int  not null check (amount_cents >= 0),
  -- Jeton de carte enregistrée, quand le prestataire en fournit un (§12 :
  -- c'est ce qui permettra le paiement en un tap). JAMAIS un numéro.
  card_token    text,
  card_last4    text check (card_last4 ~ '^[0-9]{4}$'),
  card_brand    text,
  failure_reason text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create unique index payments_provider_ref_idx
  on public.payments (provider, provider_ref)
  where provider_ref is not null;

create index payments_order_idx on public.payments (order_id, created_at desc);

create trigger payments_touch_updated_at
  before update on public.payments
  for each row execute function public.touch_updated_at();

comment on table public.payments is
  'Journal des paiements. Ne contient jamais de donnée carte : seulement un '
  'jeton, les quatre derniers chiffres et la marque, tels que renvoyés par '
  'le prestataire.';

-- Un garde-fou, parce que la règle est trop importante pour reposer sur la
-- vigilance : un jeton qui ressemble à un PAN est refusé à l'écriture.
create or replace function public.payments_reject_pan()
returns trigger
language plpgsql
as $$
begin
  if new.card_token is not null
     and regexp_replace(new.card_token, '\D', '', 'g') ~ '^[0-9]{13,19}$' then
    raise exception 'Le jeton ressemble à un numéro de carte. On ne stocke jamais de PAN (§12).'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger payments_reject_pan
  before insert or update on public.payments
  for each row execute function public.payments_reject_pan();

insert into public.settings (key, value, label, is_public) values
  ('payment_provider', to_jsonb('cash'::text),
   'Prestataire de paiement actif : cash, payzone ou cmi (§12)', true)
on conflict (key) do nothing;

/**
 * Enregistre l'intention de paiement d'une commande.
 * Appelée par la couche serveur au moment du checkout.
 */
create or replace function public.create_payment(
  p_order_id uuid,
  p_provider text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.orders%rowtype;
  v_id    uuid;
begin
  select * into v_order from public.orders where id = p_order_id;
  if not found then
    raise exception 'Commande introuvable';
  end if;

  insert into public.payments (order_id, provider, amount_cents, status)
  values (p_order_id, p_provider, v_order.total_cents, 'created')
  returning id into v_id;

  return jsonb_build_object('payment_id', v_id, 'amount_cents', v_order.total_cents);
end;
$$;

/**
 * Applique un callback de prestataire.
 *
 * Idempotente : le même `provider_ref` avec le même statut peut arriver dix
 * fois — les prestataires réessaient — sans rien changer ni rien doubler.
 * C'est ici, et nulle part ailleurs, que le paiement d'une commande devient
 * vrai.
 */
create or replace function public.apply_payment_callback(
  p_provider     text,
  p_provider_ref text,
  p_status       public.payment_event_status,
  p_payment_id   uuid default null,
  p_card_token   text default null,
  p_card_last4   text default null,
  p_card_brand   text default null,
  p_failure      text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_payment public.payments%rowtype;
begin
  -- On retrouve le paiement par son identifiant interne quand on l'a
  -- transmis au prestataire, sinon par la référence qu'il nous renvoie.
  if p_payment_id is not null then
    select * into v_payment from public.payments where id = p_payment_id for update;
  else
    select * into v_payment from public.payments
     where provider = p_provider and provider_ref = p_provider_ref for update;
  end if;

  if not found then
    raise exception 'Paiement introuvable' using errcode = 'no_data_found';
  end if;

  -- Un paiement déjà réglé ne redevient pas « échoué » parce qu'un callback
  -- en retard arrive après coup.
  if v_payment.status in ('paid', 'refunded') and p_status <> 'refunded' then
    return jsonb_build_object('status', v_payment.status, 'changed', false);
  end if;

  update public.payments
     set provider_ref    = coalesce(p_provider_ref, provider_ref),
         status          = p_status,
         card_token      = coalesce(p_card_token, card_token),
         card_last4      = coalesce(p_card_last4, card_last4),
         card_brand      = coalesce(p_card_brand, card_brand),
         failure_reason  = p_failure
   where id = v_payment.id;

  update public.orders
     set payment_status = case p_status
                            when 'paid'     then 'paid'::public.payment_status
                            when 'refunded' then 'refunded'::public.payment_status
                            when 'failed'   then 'failed'::public.payment_status
                            when 'expired'  then 'failed'::public.payment_status
                            else payment_status
                          end
   where id = v_payment.order_id;

  perform public.write_audit(
    'payment.callback', 'payments', v_payment.id::text,
    jsonb_build_object('provider', p_provider, 'status', p_status, 'ref', p_provider_ref)
  );

  return jsonb_build_object('status', p_status, 'changed', true,
                            'order_id', v_payment.order_id);
end;
$$;

alter table public.payments enable row level security;

create policy payments_read_staff on public.payments for select
  using (public.is_at_least('manager'));

-- Le client ne lit pas la table des paiements : l'état qui le concerne est
-- sur sa commande. Aucune policy d'écriture nulle part.
revoke insert, update, delete on public.payments from anon, authenticated;

revoke all on function public.create_payment(uuid, text) from public;
revoke all on function public.apply_payment_callback(
  text, text, public.payment_event_status, uuid, text, text, text, text) from public;

-- ─── 013_messages.sql ───────────────────────────────────────────────

-- =============================================================================
-- Easy Burger — 013_messages
-- -----------------------------------------------------------------------------
-- §13 — les messages clients.
--
-- La mise en file se fait en base, par trigger, dans la même transaction que
-- l'événement qui la déclenche : une commande confirmée sans message en file
-- est impossible. L'envoi, lui, est fait par un adaptateur côté application —
-- SMS aujourd'hui, WhatsApp demain, sans toucher à ce fichier.
-- =============================================================================

create type public.message_channel as enum ('sms', 'whatsapp', 'push');
create type public.message_status  as enum ('pending', 'sent', 'failed', 'skipped');

create table public.messages_log (
  id          uuid primary key default gen_random_uuid(),
  customer_id uuid references public.customers (id) on delete set null,
  phone       text not null,
  channel     public.message_channel not null default 'sms',
  template    text not null,
  payload     jsonb not null default '{}'::jsonb,
  status      public.message_status not null default 'pending',
  error       text,
  -- Vrai pour un message marketing : il exige un consentement séparé (§13).
  is_marketing boolean not null default false,
  created_at  timestamptz not null default now(),
  sent_at     timestamptz
);

create index messages_log_pending_idx on public.messages_log (status, created_at)
  where status = 'pending';
create index messages_log_customer_idx on public.messages_log (customer_id, created_at desc);

-- Un même message ne part pas deux fois pour le même événement : la clé
-- d'unicité est portée par le gabarit et sa référence.
alter table public.messages_log add column dedupe_key text;
create unique index messages_log_dedupe_idx
  on public.messages_log (dedupe_key)
  where dedupe_key is not null;

/**
 * Met un message en file.
 *
 * Silencieuse par conception : un client sans téléphone exploitable, ou un
 * message marketing sans consentement, ne doit pas faire échouer la commande
 * qui l'a déclenché.
 */
create or replace function public.enqueue_message(
  p_customer_id  uuid,
  p_template     text,
  p_payload      jsonb default '{}'::jsonb,
  p_dedupe_key   text default null,
  p_is_marketing boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_customer public.customers%rowtype;
  v_id       uuid;
begin
  select * into v_customer from public.customers where id = p_customer_id;
  if not found or v_customer.phone is null then
    return null;
  end if;

  -- §13 : « le marketing viendra plus tard, et seulement vers les clients
  -- ayant donné leur accord ». Le consentement transactionnel est implicite,
  -- le consentement marketing ne l'est jamais.
  if p_is_marketing and not v_customer.marketing_consent then
    insert into public.messages_log (
      customer_id, phone, template, payload, status, is_marketing, error
    ) values (
      p_customer_id, v_customer.phone, p_template, p_payload, 'skipped', true,
      'Pas de consentement marketing'
    );
    return null;
  end if;

  begin
    insert into public.messages_log (
      customer_id, phone, template, payload, dedupe_key, is_marketing
    ) values (
      p_customer_id, v_customer.phone, p_template, p_payload, p_dedupe_key, p_is_marketing
    )
    returning id into v_id;
  exception when unique_violation then
    return null;   -- déjà en file pour cet événement
  end;

  return v_id;
end;
$$;

-- =============================================================================
-- Les déclencheurs
-- -----------------------------------------------------------------------------
-- Par trigger plutôt qu'à l'intérieur des fonctions métier : la mise en file
-- suit l'événement quoi qu'il arrive, y compris si un jour la commande change
-- de statut par un autre chemin.
-- =============================================================================

/** Confirmation de commande, puis « prête » ou « partie en livraison ». */
create or replace function public.notify_order_status()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.customer_id is null then
    return null;
  end if;

  if tg_op = 'INSERT' then
    perform public.enqueue_message(
      new.customer_id, 'order_received',
      jsonb_build_object('order_number', new.order_number, 'total_cents', new.total_cents),
      'order_received:' || new.id::text
    );
    return null;
  end if;

  if new.status is distinct from old.status then
    if new.status = 'ready' then
      perform public.enqueue_message(
        new.customer_id, 'order_ready',
        jsonb_build_object('order_number', new.order_number),
        'order_ready:' || new.id::text
      );
    elsif new.status = 'delivering' then
      perform public.enqueue_message(
        new.customer_id, 'order_delivering',
        jsonb_build_object('order_number', new.order_number),
        'order_delivering:' || new.id::text
      );
    end if;
  end if;

  return null;
end;
$$;

create trigger orders_notify_status
  after insert or update of status on public.orders
  for each row execute function public.notify_order_status();

/** Points crédités au comptoir, et code de récompense débloqué. */
create or replace function public.notify_loyalty()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- §6.4b : « le client reçoit une confirmation par message ».
  if new.source = 'pos_ticket' and new.points > 0 then
    perform public.enqueue_message(
      new.customer_id, 'points_credited',
      jsonb_build_object('points', new.points, 'ticket_ref', new.source_ref),
      'points_credited:' || new.id::text
    );
  elsif new.source = 'glovo_code' and new.points > 0 then
    perform public.enqueue_message(
      new.customer_id, 'points_credited_glovo',
      jsonb_build_object('points', new.points),
      'points_glovo:' || new.id::text
    );
  end if;

  return null;
end;
$$;

create trigger loyalty_notify
  after insert on public.loyalty_transactions
  for each row execute function public.notify_loyalty();

/** Récompense débloquée : le code part aussi par message, pas seulement à l'écran. */
create or replace function public.notify_redemption()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_title text;
begin
  select title into v_title from public.rewards where id = new.reward_id;

  perform public.enqueue_message(
    new.customer_id,
    case when new.points_spent = 0 then 'gift_granted' else 'reward_unlocked' end,
    jsonb_build_object('code', new.code, 'title', v_title, 'expires_at', new.expires_at),
    'redemption:' || new.id::text
  );

  return null;
end;
$$;

create trigger redemptions_notify
  after insert on public.reward_redemptions
  for each row execute function public.notify_redemption();

/**
 * §6.3 — alerte 30 jours avant l'expiration d'un lot de points.
 * À passer une fois par jour.
 */
create or replace function public.enqueue_expiry_warnings(p_days int default 30)
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_row   record;
  v_count int := 0;
begin
  for v_row in select * from public.points_expiring_soon(p_days)
  loop
    if public.enqueue_message(
         v_row.customer_id, 'points_expiring',
         jsonb_build_object('points', v_row.points, 'expires_on', v_row.expires_on),
         'expiring:' || v_row.customer_id::text || ':' || v_row.expires_on::text
       ) is not null then
      v_count := v_count + 1;
    end if;
  end loop;

  return v_count;
end;
$$;

/** Marque un message envoyé ou en échec. Appelée par l'adaptateur. */
create or replace function public.mark_message(
  p_id     uuid,
  p_status public.message_status,
  p_error  text default null
)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  update public.messages_log
     set status  = p_status,
         error   = p_error,
         sent_at = case when p_status = 'sent' then now() else sent_at end
   where id = p_id;
$$;

alter table public.messages_log enable row level security;

create policy messages_read_staff on public.messages_log for select
  using (public.is_at_least('admin'));

create policy messages_read_self on public.messages_log for select
  using (exists (
    select 1 from public.customers c
    where c.id = messages_log.customer_id and c.auth_user_id = auth.uid()
  ));

revoke insert, update, delete on public.messages_log from anon, authenticated;

revoke all on function public.enqueue_message(uuid, text, jsonb, text, boolean) from public;
revoke all on function public.enqueue_expiry_warnings(int) from public;
revoke all on function public.mark_message(uuid, public.message_status, text) from public;

-- ─── 014_menu_listing.sql ───────────────────────────────────────────────

-- =============================================================================
-- Easy Burger — 014_menu_listing
-- -----------------------------------------------------------------------------
-- Retirer un produit de la carte n'est pas la même chose que le mettre en
-- rupture. « Épuisé » se dit au client et revient demain ; « retiré » ne
-- s'affiche pas du tout.
--
-- Deux colonnes plutôt qu'une suppression : ce qui est retiré se remet en un
-- clic depuis le back-office, sans repasser par une migration.
-- =============================================================================

alter table public.products
  add column is_listed boolean not null default true;

comment on column public.products.is_listed is
  'Présent sur la carte. À distinguer de is_available, qui est la rupture du jour.';

-- Retirés de la carte pour le moment, sur décision du restaurant.
update public.products set is_listed = false
 where slug in ('salade-cesar', 'milkshake');

-- La récompense « Milkshake ou soft serve » pointait sur le milkshake, qui
-- n'est plus à la carte : elle bascule sur le soft serve.
update public.rewards
   set title = 'Soft serve',
       product_id = (select id from public.products where slug = 'soft-serve')
 where slug = 'milkshake';
