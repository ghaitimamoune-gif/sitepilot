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
