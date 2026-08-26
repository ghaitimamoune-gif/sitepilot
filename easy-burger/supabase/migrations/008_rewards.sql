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
