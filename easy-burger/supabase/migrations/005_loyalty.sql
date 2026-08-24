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
