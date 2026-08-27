\set ON_ERROR_STOP on
\pset pager off

do $$
begin
  perform set_config('t.cashier',
    (select id::text from public.staff_users where role = 'cashier' limit 1), false);
end $$;

\echo '--- la file se remplit toute seule'
do $$
declare v_res jsonb; v_order uuid; v_burger uuid; v_cust uuid; v_n int;
begin
  select id into v_burger from public.products where slug = 'cheeseburger';

  v_res := public.place_order(jsonb_build_object(
    'mode', 'pickup', 'phone', '0688990011',
    'items', jsonb_build_array(jsonb_build_object('product_id', v_burger, 'qty', 2))));
  v_order := (v_res->>'id')::uuid;
  select id into v_cust from public.customers where phone = '+212688990011';

  perform test_ok('confirmation de commande mise en file',
    exists (select 1 from public.messages_log
             where customer_id = v_cust and template = 'order_received'));

  perform set_config('request.jwt.claims',
    json_build_object('sub', current_setting('t.cashier'), 'role', 'authenticated')::text, false);

  perform public.set_order_status(v_order, 'preparing');
  perform public.set_order_status(v_order, 'ready');
  perform test_ok('« commande prête » mise en file',
    exists (select 1 from public.messages_log
             where customer_id = v_cust and template = 'order_ready'));

  -- Repasser par le même statut ne doit pas remettre un message en file.
  perform public.set_order_status(v_order, 'preparing');
  perform public.set_order_status(v_order, 'ready');
  select count(*) into v_n from public.messages_log
   where customer_id = v_cust and template = 'order_ready';
  perform test_ok('pas de doublon sur le même événement', v_n = 1);

  perform public.credit_ticket_points('0688990011', 5000, 'MSG-1');
  perform test_ok('crédit au comptoir annoncé au client',
    exists (select 1 from public.messages_log
             where customer_id = v_cust and template = 'points_credited'));
end $$;

\echo '--- consentement marketing'
do $$
declare v_cust uuid; v_id uuid;
begin
  insert into public.customers (phone) values ('0688990022') returning id into v_cust;

  v_id := public.enqueue_message(v_cust, 'promo', '{}'::jsonb, null, true);
  perform test_ok('sans consentement, le message marketing n''est pas envoyé', v_id is null);
  perform test_ok('le refus est tracé, pas silencieux',
    (select status from public.messages_log
      where customer_id = v_cust and is_marketing) = 'skipped');

  update public.customers set marketing_consent = true where id = v_cust;
  v_id := public.enqueue_message(v_cust, 'promo', '{}'::jsonb, null, true);
  perform test_ok('avec consentement, il part', v_id is not null);

  -- Le transactionnel ne dépend jamais du consentement marketing.
  insert into public.customers (phone) values ('0688990033');
  perform test_ok('un message transactionnel part sans consentement marketing',
    public.enqueue_message(
      (select id from public.customers where phone = '+212688990033'),
      'order_received', '{}'::jsonb) is not null);
end $$;

\echo '--- alerte d''expiration'
do $$
declare v_cust uuid; v_n int;
begin
  insert into public.customers (phone) values ('0688990044') returning id into v_cust;
  insert into public.loyalty_transactions (customer_id, type, source, source_ref, points, expires_at)
  values (v_cust, 'earn', 'pos_ticket', 'EXP-1', 500, (current_date + 30)::timestamptz);

  v_n := public.enqueue_expiry_warnings(30);
  perform test_ok('alerte mise en file', v_n >= 1);

  v_n := public.enqueue_expiry_warnings(30);
  perform test_ok('le job peut tourner deux fois sans doubler', v_n = 0);
end $$;

\echo ''
\echo '================== MESSAGES : TOUS LES TESTS PASSENT =================='
