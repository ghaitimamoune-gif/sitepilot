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
