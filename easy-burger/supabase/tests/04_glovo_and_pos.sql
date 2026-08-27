\set ON_ERROR_STOP on
\pset pager off

do $$
begin
  perform set_config('t.cashier',
    (select id::text from public.staff_users where role = 'cashier' limit 1), false);
  perform set_config('t.super',
    (select id::text from public.staff_users where role = 'superadmin' limit 1), false);
end $$;

\echo '--- codes de sac Glovo'
do $$
declare v_codes text[]; v_res jsonb;
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', current_setting('t.cashier'), 'role', 'authenticated')::text, false);
  perform test_raises('un caissier ne génère pas de lot',
    $q$select public.generate_claim_codes('test', 5, 50)$q$,
    'Accès refusé');

  perform set_config('request.jwt.claims',
    json_build_object('sub', current_setting('t.super'), 'role', 'authenticated')::text, false);

  select array_agg(c) into v_codes from public.generate_claim_codes('sacs-aout', 10, 50) c;
  perform test_ok('10 codes générés', array_length(v_codes, 1) = 10);
  perform test_ok('codes de 8 caractères', length(v_codes[1]) = 8);
  perform test_ok('aucun glyphe ambigu (0, O, 1, I, L)',
    not exists (select 1 from unnest(v_codes) c where c ~ '[01IOL]'));
  perform test_ok('tous distincts',
    (select count(distinct c) from unnest(v_codes) c) = 10);
  perform set_config('t.code', v_codes[1], false);

  perform test_raises('un lot de 5000 codes est refusé',
    $q$select public.generate_claim_codes('trop', 5000, 50)$q$,
    'entre 1 et 2000');
end $$;

\echo '--- réclamation d''un code de sac'
do $$
declare v_res jsonb;
begin
  -- Le client scanne : aucun compte requis.
  perform set_config('request.jwt.claims', '{}', false);

  v_res := public.claim_glovo_code(current_setting('t.code'), '06 90 00 00 01');
  perform test_ok('50 points crédités', (v_res->>'points')::int = 50);
  perform test_ok('compte créé à la volée', (v_res->>'customer_created')::boolean);
  perform test_ok('numéro normalisé', (v_res->>'phone') = '+212690000001');

  perform test_raises('le même code ne repasse pas',
    format($q$select public.claim_glovo_code('%s', '0690000002')$q$, current_setting('t.code')),
    'déjà été utilisé');

  perform test_raises('un code inconnu est refusé',
    $q$select public.claim_glovo_code('ZZZZZZZZ', '0690000002')$q$,
    'Code inconnu');

  perform test_ok('le code est marqué consommé',
    (select status from public.claim_codes where code = current_setting('t.code')) = 'redeemed');
end $$;

\echo '--- réclamation par ticket'
do $$
declare
  v_uid  uuid;
  v_cust uuid;
  v_res  jsonb;
begin
  insert into auth.users (email) values ('claim@test.ma') returning id into v_uid;
  insert into public.customers (phone, auth_user_id) values ('0690000010', v_uid)
    returning id into v_cust;
  perform set_config('t.claim_cust', v_cust::text, false);
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_uid, 'role', 'authenticated')::text, false);

  v_res := public.submit_pos_claim('a-2001', 8500, current_date - 1);
  perform test_ok('réclamation enregistrée en attente', (v_res->>'status') = 'pending');
  perform test_ok('référence normalisée', (v_res->>'ticket_ref') = 'A2001');

  perform test_raises('un ticket ne se réclame qu''une fois',
    $q$select public.submit_pos_claim('A 2001', 8500, current_date - 1)$q$,
    'déjà été réclamé');

  perform test_raises('hors fenêtre de 7 jours',
    $q$select public.submit_pos_claim('A-2002', 5000, current_date - 30)$q$,
    'dans les 7 jours');

  perform test_raises('date future refusée',
    $q$select public.submit_pos_claim('A-2003', 5000, current_date + 1)$q$,
    'dans les 7 jours');
end $$;

\echo '--- import de l''export de ventes et rapprochement'
do $$
declare v_res jsonb; v_cust uuid := current_setting('t.claim_cust')::uuid;
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', current_setting('t.super'), 'role', 'authenticated')::text, false);

  v_res := public.import_pos_tickets(jsonb_build_array(
    jsonb_build_object('ref', 'A-2001', 'amount_cents', 8500, 'date', (current_date - 1)::text),
    jsonb_build_object('ref', 'A-2004', 'amount_cents', 4000, 'date', (current_date - 1)::text),
    jsonb_build_object('ref', '',       'amount_cents', 100,  'date', (current_date)::text)
  ));
  perform test_ok('2 tickets importés, 1 ligne illisible ignorée',
    (v_res->>'inserted')::int = 2 and (v_res->>'skipped')::int = 1);

  -- Réimporter le même fichier ne doit rien doubler.
  v_res := public.import_pos_tickets(jsonb_build_array(
    jsonb_build_object('ref', 'A-2001', 'amount_cents', 8500, 'date', (current_date - 1)::text)));
  perform test_ok('réimport sans doublon', (v_res->>'inserted')::int = 0);

  v_res := public.reconcile_pos_claims();
  perform test_ok('la réclamation est rapprochée', (v_res->>'matched')::int = 1);
  perform test_ok('85 points crédités',
    (select points_balance from public.customers where id = v_cust) = 85);
  perform test_ok('le crédit porte la référence du ticket',
    exists (select 1 from public.loyalty_transactions
             where customer_id = v_cust and source = 'pos_ticket' and source_ref = 'A2001'));
end $$;

\echo '--- rapprochement : les cas de rejet'
do $$
declare
  v_uid  uuid;
  v_cust uuid;
  v_res  jsonb;
begin
  insert into auth.users (email) values ('claim2@test.ma') returning id into v_uid;
  insert into public.customers (phone, auth_user_id) values ('0690000011', v_uid)
    returning id into v_cust;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_uid, 'role', 'authenticated')::text, false);

  -- Montant qui ne correspond pas au ticket importé.
  perform public.submit_pos_claim('A-2004', 9999, current_date - 1);

  perform set_config('request.jwt.claims',
    json_build_object('sub', current_setting('t.super'), 'role', 'authenticated')::text, false);
  v_res := public.reconcile_pos_claims();
  perform test_ok('montant divergent → rejet', (v_res->>'rejected')::int = 1);
  perform test_ok('le motif est explicite',
    (select reject_reason from public.pos_claims where ticket_ref = 'A2004')
      = 'Le montant ne correspond pas au ticket');
  perform test_ok('aucun point crédité',
    (select points_balance from public.customers where id = v_cust) = 0);

  -- Un ticket rejeté redevient réclamable : la contrainte ne couvre que
  -- « pending » et « matched ».
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_uid, 'role', 'authenticated')::text, false);
  perform public.submit_pos_claim('A-2004', 4000, current_date - 1);

  perform set_config('request.jwt.claims',
    json_build_object('sub', current_setting('t.super'), 'role', 'authenticated')::text, false);
  v_res := public.reconcile_pos_claims();
  perform test_ok('la réclamation corrigée passe', (v_res->>'matched')::int = 1);
  perform test_ok('40 points crédités',
    (select points_balance from public.customers where id = v_cust) = 40);
end $$;

\echo '--- un ticket déjà crédité au comptoir ne se réclame pas'
do $$
declare v_uid uuid; v_cust uuid;
begin
  insert into auth.users (email) values ('claim3@test.ma') returning id into v_uid;
  insert into public.customers (phone, auth_user_id) values ('0690000012', v_uid)
    returning id into v_cust;

  perform set_config('request.jwt.claims',
    json_build_object('sub', current_setting('t.cashier'), 'role', 'authenticated')::text, false);
  perform public.credit_ticket_points('0690000099', 6000, 'B-3001');

  perform set_config('request.jwt.claims',
    json_build_object('sub', v_uid, 'role', 'authenticated')::text, false);
  perform test_raises('réclamation refusée tout de suite, sans attendre la nuit',
    $q$select public.submit_pos_claim('b 3001', 6000, current_date)$q$,
    'déjà été crédité');
end $$;

\echo ''
\echo '================== GLOVO ET CAISSE : TOUS LES TESTS PASSENT =================='
