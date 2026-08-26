\set ON_ERROR_STOP on
\pset pager off

-- Le personnel a été créé par 01_ ; on le relit plutôt que de dépendre de
-- variables de session, qui ne traversent pas les fichiers.
do $$
begin
  perform set_config('t.cashier',
    (select id::text from public.staff_users where role = 'cashier' limit 1), false);
end $$;

\echo '--- boutique de récompenses'
do $$
begin
  perform test_ok('7 récompenses échangeables',
    (select count(*) from public.rewards where is_active) = 7);
  perform test_ok('les cadeaux ne sont pas échangeables librement',
    (select count(*) from public.rewards where slug in ('bienvenue','anniversaire') and not is_active) = 2);
  perform test_ok('la première récompense tombe à 120 points',
    (select min(points_cost) from public.rewards where is_active) = 120);
end $$;

\echo '--- échange de points contre un code'
do $$
declare
  v_uid  uuid;
  v_cust uuid;
  v_res  jsonb;
begin
  insert into auth.users (email) values ('reward@test.ma') returning id into v_uid;
  insert into public.customers (phone, auth_user_id) values ('0677000001', v_uid)
    returning id into v_cust;
  perform set_config('t.reward_uid', v_uid::text, false);
  perform set_config('t.reward_cust', v_cust::text, false);

  perform set_config('request.jwt.claims',
    json_build_object('sub', v_uid, 'role', 'authenticated')::text, false);

  perform test_raises('sans points, pas de récompense',
    $q$select public.redeem_reward('frites-maison')$q$,
    'manque');

  -- On crédite 300 points par une commande fictive.
  insert into public.loyalty_transactions (customer_id, type, source, source_ref, points, expires_at)
  values (v_cust, 'earn', 'pos_ticket', 'RW-1', 300, now() + interval '12 months');

  v_res := public.redeem_reward('frites-maison');
  perform test_ok('code à 6 chiffres émis', (v_res->>'code') ~ '^[0-9]{6}$');
  perform test_ok('250 points débités', (v_res->>'new_balance')::int = 50);
  perform test_ok('validité de 15 minutes',
    (v_res->>'expires_at')::timestamptz between now() + interval '14 minutes'
                                           and now() + interval '16 minutes');
  perform set_config('t.code', v_res->>'code', false);

  perform test_raises('un seul code en cours à la fois',
    $q$select public.redeem_reward('sauce-maison')$q$,
    'déjà un code');
end $$;

\echo '--- consommation du code au comptoir'
do $$
declare v_res jsonb;
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', current_setting('t.reward_uid'), 'role', 'authenticated')::text, false);
  perform test_raises('un client ne peut pas consommer un code',
    format($q$select public.consume_reward_code('%s')$q$, current_setting('t.code')),
    'Accès refusé');

  perform set_config('request.jwt.claims',
    json_build_object('sub', current_setting('t.cashier'), 'role', 'authenticated')::text, false);

  v_res := public.consume_reward_code(current_setting('t.code'));
  perform test_ok('le caissier consomme le code', (v_res->>'title') = 'Frites maison');

  perform test_raises('un code consommé ne repasse pas',
    format($q$select public.consume_reward_code('%s')$q$, current_setting('t.code')),
    'inconnu ou déjà utilisé');

  perform test_ok('les points restent débités',
    (select points_balance from public.customers where id = current_setting('t.reward_cust')::uuid) = 50);
end $$;

\echo '--- code expiré : les points reviennent'
do $$
declare
  v_cust uuid := current_setting('t.reward_cust')::uuid;
  v_res  jsonb;
  v_n    int;
begin
  insert into public.loyalty_transactions (customer_id, type, source, source_ref, points, expires_at)
  values (v_cust, 'earn', 'pos_ticket', 'RW-2', 200, now() + interval '12 months');

  perform set_config('request.jwt.claims',
    json_build_object('sub', current_setting('t.reward_uid'), 'role', 'authenticated')::text, false);
  v_res := public.redeem_reward('sauce-maison');
  perform test_ok('120 points débités', (v_res->>'new_balance')::int = 130);

  -- On force l'échéance, puis on passe le balai.
  update public.reward_redemptions set expires_at = now() - interval '1 minute'
   where id = (v_res->>'id')::uuid;

  v_n := public.expire_reward_codes();
  perform test_ok('un code expiré balayé', v_n = 1);
  perform test_ok('les points sont rendus',
    (select points_balance from public.customers where id = v_cust) = 250);
  perform test_ok('le remboursement est tracé dans le ledger',
    exists (select 1 from public.loyalty_transactions
             where customer_id = v_cust and note like 'Code non utilisé%'));

  perform set_config('request.jwt.claims',
    json_build_object('sub', current_setting('t.cashier'), 'role', 'authenticated')::text, false);
  perform test_raises('un code expiré n''est plus consommable',
    format($q$select public.consume_reward_code('%s')$q$, v_res->>'code'),
    'inconnu ou déjà utilisé');
end $$;

\echo '--- offre de bienvenue : une fois par numéro'
do $$
declare
  v_burger uuid;
  v_res    jsonb;
  v_order1 uuid;
  v_order2 uuid;
  v_cust   uuid;
begin
  select id into v_burger from public.products where slug = 'home-made-burger';

  -- 80 MAD > seuil de 70 MAD
  v_res := public.place_order(jsonb_build_object(
    'mode', 'pickup', 'phone', '0677000002',
    'items', jsonb_build_array(jsonb_build_object('product_id', v_burger, 'qty', 1))));
  v_order1 := (v_res->>'id')::uuid;

  v_res := public.place_order(jsonb_build_object(
    'mode', 'pickup', 'phone', '0677000002',
    'items', jsonb_build_array(jsonb_build_object('product_id', v_burger, 'qty', 1))));
  v_order2 := (v_res->>'id')::uuid;

  select id into v_cust from public.customers where phone = '+212677000002';

  perform set_config('request.jwt.claims',
    json_build_object('sub', current_setting('t.cashier'), 'role', 'authenticated')::text, false);

  v_res := public.set_order_status(v_order1, 'completed');
  perform test_ok('offre de bienvenue accordée', (v_res->>'welcome_granted')::boolean);

  v_res := public.set_order_status(v_order2, 'completed');
  perform test_ok('pas une seconde fois', (v_res->>'welcome_granted')::boolean = false);

  perform test_ok('un seul cadeau de bienvenue en base',
    (select count(*) from public.reward_redemptions
      where customer_id = v_cust and grant_key like 'welcome:%') = 1);
  perform test_ok('le cadeau ne coûte aucun point',
    (select points_spent from public.reward_redemptions
      where customer_id = v_cust and grant_key like 'welcome:%') = 0);
end $$;

do $$
declare v_res jsonb; v_soda uuid; v_order uuid;
begin
  -- Commande sous le seuil : pas d'offre.
  select id into v_soda from public.products where slug = 'soda';
  v_res := public.place_order(jsonb_build_object(
    'mode', 'pickup', 'phone', '0677000003',
    'items', jsonb_build_array(jsonb_build_object('product_id', v_soda, 'qty', 1))));
  v_order := (v_res->>'id')::uuid;

  perform set_config('request.jwt.claims',
    json_build_object('sub', current_setting('t.cashier'), 'role', 'authenticated')::text, false);
  v_res := public.set_order_status(v_order, 'completed');
  perform test_ok('sous le seuil, pas d''offre de bienvenue',
    (v_res->>'welcome_granted')::boolean = false);
end $$;

\echo '--- anniversaire : une fois par an'
do $$
declare v_cust uuid; v_n int;
begin
  insert into public.customers (phone, birthdate)
  values ('0677000004', (current_date + 3) - interval '30 years')
  returning id into v_cust;

  v_n := public.grant_birthday_rewards();
  perform test_ok('cadeau d''anniversaire accordé 3 jours avant', v_n >= 1);

  v_n := public.grant_birthday_rewards();
  perform test_ok('le job peut tourner deux fois sans doubler', v_n = 0);

  perform test_ok('validité de 7 jours',
    (select expires_at::date - current_date from public.reward_redemptions
      where customer_id = v_cust and grant_key like 'birthday:%') = 7);
end $$;

\echo '--- expiration des points en FIFO'
do $$
declare
  v_cust uuid;
  v_n    int;
begin
  insert into public.customers (phone) values ('0677000005') returning id into v_cust;

  -- Trois lots : deux échus, un valide.
  insert into public.loyalty_transactions (customer_id, type, source, source_ref, points, expires_at, created_at)
  values (v_cust, 'earn', 'pos_ticket', 'FIFO-1', 100, now() - interval '1 day', now() - interval '370 days'),
         (v_cust, 'earn', 'pos_ticket', 'FIFO-2', 100, now() - interval '1 day', now() - interval '369 days'),
         (v_cust, 'earn', 'pos_ticket', 'FIFO-3', 100, now() + interval '60 days', now() - interval '10 days');

  -- 150 points déjà dépensés : ils mangent le lot 1 en entier et la moitié du 2.
  insert into public.loyalty_transactions (customer_id, type, source, source_ref, points)
  values (v_cust, 'redeem', 'reward', 'FIFO-SPEND', -150);

  perform test_ok('solde avant expiration : 150',
    (select points_balance from public.customers where id = v_cust) = 150);

  v_n := public.expire_points();

  -- Lot 1 : consommé, rien à expirer. Lot 2 : 50 restants, échus.
  -- Lot 3 : intact et valide.
  perform test_ok('un seul lot expire', v_n = 1);
  perform test_ok('seuls les 50 points non consommés du lot échu partent',
    (select points_balance from public.customers where id = v_cust) = 100);
  perform test_ok('l''expiration est tracée',
    exists (select 1 from public.loyalty_transactions
             where customer_id = v_cust and type = 'expire' and points = -50));

  -- Le job doit être rejouable sans dommage.
  v_n := public.expire_points();
  perform test_ok('rejouer le job n''expire rien de plus', v_n = 0);
  perform test_ok('solde stable',
    (select points_balance from public.customers where id = v_cust) = 100);
end $$;

\echo '--- alerte 30 jours avant expiration'
do $$
declare v_cust uuid; v_n int;
begin
  insert into public.customers (phone) values ('0677000006') returning id into v_cust;
  insert into public.loyalty_transactions (customer_id, type, source, source_ref, points, expires_at)
  values (v_cust, 'earn', 'pos_ticket', 'SOON-1', 400, (current_date + 30)::timestamptz);

  select count(*) into v_n from public.points_expiring_soon(30) where customer_id = v_cust;
  perform test_ok('le client apparaît dans l''alerte à 30 jours', v_n = 1);

  select count(*) into v_n from public.points_expiring_soon(7) where customer_id = v_cust;
  perform test_ok('et pas dans celle à 7 jours', v_n = 0);
end $$;

\echo ''
\echo '================== RÉCOMPENSES : TOUS LES TESTS PASSENT =================='
