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
