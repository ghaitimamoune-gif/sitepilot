\set ON_ERROR_STOP on
\pset pager off

create or replace function test_ok(label text, cond boolean) returns void language plpgsql as $$
begin
  if cond then raise notice '  OK   %', label;
  else raise exception 'ÉCHEC : %', label; end if;
end $$;

/** Exécute une requête et vérifie qu'elle échoue avec le message attendu. */
create or replace function test_raises(label text, stmt text, expect text) returns void language plpgsql as $$
begin
  begin
    execute stmt;
  exception when others then
    if position(lower(expect) in lower(SQLERRM)) > 0 then
      raise notice '  OK   % → « % »', label, left(SQLERRM, 70);
      return;
    else
      raise exception 'ÉCHEC : % — message inattendu : %', label, SQLERRM;
    end if;
  end;
  raise exception 'ÉCHEC : % — aucune erreur levée', label;
end $$;

-- ---------------------------------------------------------------- personnel
do $$
declare u1 uuid; u2 uuid;
begin
  insert into auth.users (email) values ('caissier@easyburger.ma') returning id into u1;
  insert into auth.users (email) values ('patron@easyburger.ma')   returning id into u2;
  insert into public.staff_users (id, name, role) values (u1, 'Caissier', 'cashier');
  insert into public.staff_users (id, name, role) values (u2, 'Mamoune',  'superadmin');
  perform set_config('test.cashier', u1::text, false);
  perform set_config('test.super',   u2::text, false);
end $$;

\echo '--- menu'
select test_ok('4 catégories',   (select count(*) from public.categories) = 4);
select test_ok('13 produits',    (select count(*) from public.products) = 13);
select test_ok('cheeseburger à 6000 centimes',
  (select price_cents from public.products where slug = 'cheeseburger') = 6000);
select test_ok('beignets : parfum obligatoire',
  (select is_required from public.product_options o
   join public.products p on p.id = o.product_id
   where p.slug = 'beignets' and o.name = 'Parfum'));

\echo '--- normalisation du téléphone (un numéro = un compte)'
select test_ok('0612345678',        public.normalize_phone('0612345678')        = '+212612345678');
select test_ok('+212 612 345 678',  public.normalize_phone('+212 612 345 678')  = '+212612345678');
select test_ok('00212612345678',    public.normalize_phone('00212612345678')    = '+212612345678');
select test_ok('612345678',         public.normalize_phone('612345678')         = '+212612345678');
select test_ok('06 12 34 56 78',    public.normalize_phone('06 12 34 56 78')    = '+212612345678');
select test_ok('bruit → null',      public.normalize_phone('abc') is null);

\echo '--- place_order : les prix sont recalculés en base'
do $$
declare
  v_res jsonb;
  v_cheese uuid;
  v_bacon  uuid;
  v_order  uuid;
begin
  select id into v_cheese from public.products where slug = 'cheeseburger';
  select v.id into v_bacon
    from public.product_option_values v
    join public.product_options o on o.id = v.option_id
   where o.product_id = v_cheese and v.name = 'Bacon de bœuf';

  v_res := public.place_order(jsonb_build_object(
    'mode', 'pickup',
    'phone', '06 12 34 56 78',
    'name', 'Yasmine',
    'items', jsonb_build_array(
      jsonb_build_object('product_id', v_cheese, 'qty', 2,
                         'options', jsonb_build_array(v_bacon))
    )
  ));

  v_order := (v_res->>'id')::uuid;
  perform set_config('test.order', v_order::text, false);

  -- 6000 + 1500 (bacon) = 7500 l'unité, × 2 = 15000
  perform test_ok('total recalculé côté serveur : 15000 centimes',
    (v_res->>'total_cents')::int = 15000);
  perform test_ok('numéro de commande lisible',
    (v_res->>'order_number') like 'EB-%');
  perform test_ok('client créé à la volée sur le téléphone normalisé',
    exists (select 1 from public.customers where phone = '+212612345678'));
  perform test_ok('snapshot du nom sur la ligne',
    (select name_snapshot from public.order_items where order_id = v_order) = 'Cheeseburger');
end $$;

\echo '--- place_order : refus'
select test_raises('panier vide',
  $q$select public.place_order('{"mode":"pickup","phone":"0612345678","items":[]}'::jsonb)$q$,
  'Panier vide');
select test_raises('adresse manquante en livraison',
  $q$select public.place_order(('{"mode":"delivery","phone":"0612345678","items":[{"product_id":"'
    || (select id from public.products where slug='soda') || '","qty":1}]}')::jsonb)$q$,
  'Adresse');
select test_raises('téléphone illisible',
  $q$select public.place_order('{"mode":"pickup","phone":"xx","items":[]}'::jsonb)$q$,
  'téléphone');

do $$
declare v_id uuid;
begin
  select id into v_id from public.products where slug = 'soda';
  update public.products set is_available = false where id = v_id;
  perform test_raises('produit en rupture refusé',
    format($q$select public.place_order('{"mode":"pickup","phone":"0612345678","items":[{"product_id":"%s","qty":1}]}'::jsonb)$q$, v_id),
    'disponible');
  update public.products set is_available = true where id = v_id;
end $$;

\echo '--- crédit automatique au passage en completed'
do $$
declare v_order uuid := current_setting('test.order')::uuid; v_res jsonb;
begin
  perform set_config('request.jwt.claim.sub', current_setting('test.cashier'), false);

  v_res := public.set_order_status(v_order, 'completed');
  -- 15000 centimes = 150 MAD = 150 points
  perform test_ok('150 points crédités', (v_res->>'points_credited')::int = 150);
  perform test_ok('solde du client à 150',
    (select points_balance from public.customers where phone = '+212612345678') = 150);

  -- Repasser par completed ne doit rien recréditer.
  perform public.set_order_status(v_order, 'preparing');
  v_res := public.set_order_status(v_order, 'completed');
  perform test_ok('pas de double crédit sur la même commande',
    (v_res->>'points_credited')::int = 0);
  perform test_ok('solde inchangé',
    (select points_balance from public.customers where phone = '+212612345678') = 150);
end $$;

\echo '--- LA garantie : un ticket = un crédit'
do $$
declare v_res jsonb;
begin
  perform set_config('request.jwt.claim.sub', current_setting('test.cashier'), false);

  v_res := public.credit_ticket_points('0655443322', 7400, 'A-1042');
  perform test_ok('74 MAD → 74 points', (v_res->>'points_credited')::int = 74);
  perform test_ok('compte créé à la volée', (v_res->>'customer_created')::boolean);

  perform test_raises('même ticket, deuxième saisie → refus',
    $q$select public.credit_ticket_points('0655443322', 7400, 'A-1042')$q$,
    'déjà été crédité');

  perform test_raises('même ticket écrit autrement → refus aussi',
    $q$select public.credit_ticket_points('0655443322', 7400, 'a 1042')$q$,
    'déjà été crédité');

  perform test_raises('même ticket, autre client → refus aussi',
    $q$select public.credit_ticket_points('0699887766', 7400, 'A1042')$q$,
    'déjà été crédité');

  perform test_ok('solde toujours à 74',
    (select points_balance from public.customers where phone = '+212655443322') = 74);

  -- Un autre ticket passe normalement.
  v_res := public.credit_ticket_points('0655443322', 5000, 'A-1043');
  perform test_ok('ticket suivant crédité', (v_res->>'points_credited')::int = 50);
  perform test_ok('solde cumulé à 124', (v_res->>'new_balance')::int = 124);

  perform test_raises('référence de ticket vide → refus',
    $q$select public.credit_ticket_points('0655443322', 5000, '  ')$q$,
    'Référence');
end $$;

\echo '--- plafond quotidien par caissier'
do $$
begin
  perform set_config('request.jwt.claim.sub', current_setting('test.super'), false);
  update public.settings set value = to_jsonb(200) where key = 'cashier_daily_points_cap';

  perform set_config('request.jwt.claim.sub', current_setting('test.cashier'), false);
  perform test_raises('au-delà du plafond → refus',
    $q$select public.credit_ticket_points('0611223344', 50000, 'B-9001')$q$,
    'Plafond');

  perform set_config('request.jwt.claim.sub', current_setting('test.super'), false);
  update public.settings set value = to_jsonb(20000) where key = 'cashier_daily_points_cap';
end $$;

\echo '--- superadmin : ajustement manuel'
do $$
declare v_cust uuid; v_res jsonb;
begin
  select id into v_cust from public.customers where phone = '+212655443322';

  perform set_config('request.jwt.claim.sub', current_setting('test.cashier'), false);
  perform test_raises('un caissier ne peut pas ajuster',
    format($q$select public.adjust_points('%s', 500, 'geste commercial')$q$, v_cust),
    'superadmin');

  perform set_config('request.jwt.claim.sub', current_setting('test.super'), false);
  perform test_raises('motif obligatoire',
    format($q$select public.adjust_points('%s', 500, '')$q$, v_cust),
    'motif');

  v_res := public.adjust_points(v_cust, 500, 'Geste commercial — commande Glovo perdue');
  perform test_ok('superadmin crédite 500 points', (v_res->>'new_balance')::int = 624);

  v_res := public.adjust_points(v_cust, -100, 'Correction de saisie');
  perform test_ok('superadmin retire 100 points', (v_res->>'new_balance')::int = 524);

  perform test_ok('deux ajustements manuels restent possibles',
    (select count(*) from public.loyalty_transactions
      where customer_id = v_cust and source = 'manual') = 2);

  perform test_raises('solde négatif refusé',
    format($q$select public.adjust_points('%s', -99999, 'test')$q$, v_cust),
    'négatif');

  perform test_ok('ajustements tracés dans l''audit',
    (select count(*) from public.audit_log where action = 'loyalty.adjust') = 2);
end $$;

\echo '--- le ledger fait foi : le cache se recalcule'
do $$
declare v_cust uuid; v_sum int;
begin
  select id into v_cust from public.customers where phone = '+212655443322';
  update public.customers set points_balance = 99999 where id = v_cust;

  -- Une écriture quelconque dans le ledger doit remettre le cache d'aplomb.
  perform set_config('request.jwt.claim.sub', current_setting('test.super'), false);
  perform public.adjust_points(v_cust, 1, 'sonde');

  select sum(points) into v_sum from public.loyalty_transactions where customer_id = v_cust;
  perform test_ok('cache recalculé depuis le ledger',
    (select points_balance from public.customers where id = v_cust) = v_sum);
end $$;

\echo ''
\echo '================== TOUS LES TESTS PASSENT =================='
