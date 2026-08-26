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
