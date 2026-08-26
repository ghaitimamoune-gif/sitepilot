\set ON_ERROR_STOP on
\pset pager off

\echo '--- correctif : un client ne peut pas s''écrire des points'
do $$
declare
  v_uid  uuid;
  v_cust uuid;
begin
  insert into auth.users (email) values ('client@test.ma') returning id into v_uid;
  insert into public.customers (phone, auth_user_id) values ('0600000001', v_uid)
    returning id into v_cust;

  perform set_config('test.client_uid', v_uid::text, false);
  perform set_config('test.client_cust', v_cust::text, false);
end $$;

do $$
declare v_cust uuid := current_setting('test.client_cust')::uuid;
begin
  set local role authenticated;
  perform set_config('request.jwt.claims',
    json_build_object('sub', current_setting('test.client_uid'), 'role', 'authenticated')::text,
    true);

  -- Le profil reste modifiable par son propriétaire.
  update public.customers set first_name = 'Sofia' where id = v_cust;
  perform test_ok('le client modifie son prénom',
    (select first_name from public.customers where id = v_cust) = 'Sofia');

  -- Le solde, non : le GRANT ne couvre pas la colonne.
  perform test_raises('le client ne peut pas écrire son solde',
    format($q$update public.customers set points_balance = 999999 where id = '%s'$q$, v_cust),
    'permission denied');

  perform test_raises('ni sa dépense cumulée',
    format($q$update public.customers set lifetime_spend = 999999 where id = '%s'$q$, v_cust),
    'permission denied');

  perform test_raises('ni écrire directement dans le ledger',
    format($q$insert into public.loyalty_transactions (customer_id, type, source, points)
              values ('%s', 'earn', 'manual', 5000)$q$, v_cust),
    'permission denied');

  perform test_raises('ni insérer une commande sans passer par place_order',
    $q$insert into public.orders (mode) values ('pickup')$q$,
    'permission denied');
end $$;
reset role;

\echo '--- rattachement du compte au numéro vérifié'
do $$
declare
  v_uid uuid;
  v_res jsonb;
begin
  -- Fiche créée au comptoir, sans compte : le client s'inscrit ensuite.
  insert into public.customers (phone) values ('0611111111');

  insert into auth.users (email) values ('otp1@test.ma') returning id into v_uid;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_uid, 'phone', '+212611111111', 'role', 'authenticated')::text,
    false);

  v_res := public.link_current_customer();
  perform test_ok('la fiche du comptoir est rattachée, pas dupliquée',
    (select count(*) from public.customers where phone = '+212611111111') = 1);
  perform test_ok('auth_user_id posé',
    (select auth_user_id from public.customers where phone = '+212611111111') = v_uid);

  -- Numéro inconnu : la fiche est créée.
  insert into auth.users (email) values ('otp2@test.ma') returning id into v_uid;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_uid, 'phone', '0622222222', 'role', 'authenticated')::text,
    false);
  v_res := public.link_current_customer();
  perform test_ok('numéro inconnu → fiche créée et normalisée',
    (v_res->>'phone') = '+212622222222');

  -- Nouvel appareil, nouveau compte Auth, même numéro : la fiche suit le
  -- numéro, pas le compte.
  insert into auth.users (email) values ('otp3@test.ma') returning id into v_uid;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_uid, 'phone', '0622222222', 'role', 'authenticated')::text,
    false);
  v_res := public.link_current_customer();
  perform test_ok('même numéro sur un nouveau compte → une seule fiche',
    (select count(*) from public.customers where phone = '+212622222222') = 1);
  perform test_ok('la fiche bascule sur le compte qui a prouvé le numéro',
    (select auth_user_id from public.customers where phone = '+212622222222') = v_uid);
end $$;

do $$
begin
  perform set_config('request.jwt.claims', '{}', false);
  perform test_raises('sans session, aucun rattachement',
    $q$select public.link_current_customer()$q$,
    'Aucune session');
end $$;

\echo '--- prénom demandé après la commande'
do $$
declare
  v_token uuid;
  v_cheese uuid;
  v_res jsonb;
begin
  select id into v_cheese from public.products where slug = 'cheeseburger';

  v_res := public.place_order(jsonb_build_object(
    'mode', 'pickup',
    'phone', '0633333333',
    'items', jsonb_build_array(jsonb_build_object('product_id', v_cheese, 'qty', 1))
  ));
  select public_token into v_token from public.orders where id = (v_res->>'id')::uuid;

  perform test_ok('commande possible sans prénom',
    (select first_name from public.customers where phone = '+212633333333') is null);

  perform public.name_customer_by_order_token(v_token, '  Karim ');
  perform test_ok('le prénom est enregistré depuis l''écran de suivi',
    (select first_name from public.customers where phone = '+212633333333') = 'Karim');

  -- Un lien de suivi partagé ne doit pas pouvoir renommer le client.
  perform public.name_customer_by_order_token(v_token, 'Imposteur');
  perform test_ok('un prénom déjà connu n''est jamais écrasé',
    (select first_name from public.customers where phone = '+212633333333') = 'Karim');

  perform test_raises('prénom vide refusé',
    format($q$select public.name_customer_by_order_token('%s', '   ')$q$, v_token),
    'prénom');
end $$;

\echo '--- suppression de compte'
do $$
declare
  v_uid uuid;
  v_cust uuid;
  v_order uuid;
  v_soda uuid;
  v_res jsonb;
begin
  select id into v_soda from public.products where slug = 'frites-maison';

  v_res := public.place_order(jsonb_build_object(
    'mode', 'pickup',
    'phone', '0644444444',
    'name', 'Nadia',
    'items', jsonb_build_array(jsonb_build_object('product_id', v_soda, 'qty', 4))
  ));
  v_order := (v_res->>'id')::uuid;

  select id into v_cust from public.customers where phone = '+212644444444';
  insert into auth.users (email) values ('bye@test.ma') returning id into v_uid;
  update public.customers set auth_user_id = v_uid where id = v_cust;

  perform set_config('request.jwt.claims', current_setting('test.cashier_claims', true), false);
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_uid, 'role', 'authenticated')::text, false);

  perform public.delete_my_account();

  perform test_ok('la fiche client est supprimée',
    not exists (select 1 from public.customers where phone = '+212644444444'));
  perform test_ok('le compte Auth est supprimé',
    not exists (select 1 from auth.users where id = v_uid));
  perform test_ok('la commande est conservée pour la comptabilité',
    exists (select 1 from public.orders where id = v_order));
  perform test_ok('mais vidée de toute donnée personnelle',
    (select contact_name is null and contact_phone is null and customer_id is null
       from public.orders where id = v_order));
end $$;

\echo ''
\echo '================== AUTH : TOUS LES TESTS PASSENT =================='
