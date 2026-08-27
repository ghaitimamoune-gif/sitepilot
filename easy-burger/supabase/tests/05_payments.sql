\set ON_ERROR_STOP on
\pset pager off

do $$
begin
  perform set_config('t.cashier',
    (select id::text from public.staff_users where role = 'cashier' limit 1), false);
end $$;

\echo '--- on ne stocke jamais un numéro de carte'
do $$
declare v_order uuid; v_res jsonb; v_soda uuid;
begin
  select id into v_soda from public.products where slug = 'soda';
  v_res := public.place_order(jsonb_build_object(
    'mode', 'pickup', 'phone', '0699111222',
    'items', jsonb_build_array(jsonb_build_object('product_id', v_soda, 'qty', 3))));
  v_order := (v_res->>'id')::uuid;
  perform set_config('t.pay_order', v_order::text, false);

  v_res := public.create_payment(v_order, 'cmi');
  perform set_config('t.payment', v_res->>'payment_id', false);
  perform test_ok('intention de paiement enregistrée',
    (v_res->>'amount_cents')::int = 6000);

  perform test_raises('un jeton qui ressemble à un PAN est refusé',
    format($q$update public.payments set card_token = '4111111111111111' where id = '%s'$q$,
           current_setting('t.payment')),
    'jamais de PAN');

  update public.payments set card_token = 'tok_9f2a41bc', card_last4 = '1111'
   where id = current_setting('t.payment')::uuid;
  perform test_ok('un vrai jeton passe',
    (select card_token from public.payments where id = current_setting('t.payment')::uuid)
      = 'tok_9f2a41bc');
end $$;

\echo '--- le callback fait foi, et il est rejouable'
do $$
declare v_res jsonb; v_order uuid := current_setting('t.pay_order')::uuid;
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', current_setting('t.cashier'), 'role', 'authenticated')::text, false);

  v_res := public.apply_payment_callback(
    'cmi', 'CMI-77001', 'paid', current_setting('t.payment')::uuid);
  perform test_ok('paiement confirmé', (v_res->>'changed')::boolean);
  perform test_ok('la commande passe à payée',
    (select payment_status from public.orders where id = v_order) = 'paid');

  -- Les prestataires réessaient : le même callback doit être sans effet.
  v_res := public.apply_payment_callback(
    'cmi', 'CMI-77001', 'paid', current_setting('t.payment')::uuid);
  perform test_ok('callback rejoué : aucun changement', (v_res->>'changed')::boolean = false);

  -- Un « échec » qui arrive en retard ne doit pas défaire un paiement réussi.
  v_res := public.apply_payment_callback(
    'cmi', 'CMI-77001', 'failed', current_setting('t.payment')::uuid);
  perform test_ok('un échec tardif ne défait pas un paiement réussi',
    (select payment_status from public.orders where id = v_order) = 'paid');

  -- Le remboursement, lui, passe.
  v_res := public.apply_payment_callback(
    'cmi', 'CMI-77001', 'refunded', current_setting('t.payment')::uuid);
  perform test_ok('le remboursement est appliqué',
    (select payment_status from public.orders where id = v_order) = 'refunded');

  perform test_ok('les callbacks sont tracés dans l''audit',
    (select count(*) from public.audit_log where action = 'payment.callback') >= 2);
end $$;

\echo '--- un paiement inconnu est refusé'
do $$
begin
  perform test_raises('référence inconnue',
    $q$select public.apply_payment_callback('cmi', 'CMI-INEXISTANT', 'paid')$q$,
    'introuvable');
end $$;

\echo ''
\echo '================== PAIEMENT : TOUS LES TESTS PASSENT =================='
