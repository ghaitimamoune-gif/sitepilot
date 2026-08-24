-- =============================================================================
-- Easy Burger — 006_seed_menu
-- -----------------------------------------------------------------------------
-- Le menu réel du §5. Prix en centimes entiers.
--
-- ⚠️  LES PRIX SONT À VÉRIFIER AVANT MISE EN LIGNE (§5). Ils viennent du
--    brief, pas de la caisse. Une fois vérifiés, ils se modifient depuis
--    /admin — cette migration ne sert qu'à l'amorçage.
--
-- Les produits sans photo affichent un placeholder « photo à venir » au bon
-- ratio : le passage aux vraies photos est un simple remplacement de fichier.
-- =============================================================================

insert into public.restaurants (name, address, phone, is_open)
values ('Easy Burger', 'Casablanca', null, true)
on conflict do nothing;

-- ---------------------------------------------------------------- catégories
insert into public.categories (slug, name, sort_order) values
  ('smash-burgers', 'Smash burgers', 10),
  ('salad-sides',   'Salad & sides', 20),
  ('desserts',      'Desserts',      30),
  ('drinks',        'Drinks',        40)
on conflict (slug) do nothing;

-- ------------------------------------------------------------------ produits
insert into public.products
  (category_id, slug, name, description, price_cents, image_url, sort_order, is_featured)
values
  -- SMASH BURGERS
  ((select id from public.categories where slug = 'smash-burgers'),
   'cheeseburger', 'Cheeseburger',
   'Steak smashé, cheddar, pickles, sauce maison', 6000,
   '/photos/cheeseburger.jpg', 10, true),

  ((select id from public.categories where slug = 'smash-burgers'),
   'double-cheeseburger', 'Double cheeseburger',
   'Deux steaks smashés, double cheddar, pickles, sauce maison', 7500,
   '/photos/double-cheeseburger.jpg', 20, true),

  ((select id from public.categories where slug = 'smash-burgers'),
   'home-made-burger', 'Home made burger',
   'Le burger signature de la maison', 8000,
   '/photos/home-made-burger.jpg', 30, false),

  ((select id from public.categories where slug = 'smash-burgers'),
   'burger-du-mois', 'Burger du mois',
   'La création du mois. Demande-nous ce qu''il y a dedans.', 8000,
   null, 40, false),

  -- SALAD & SIDES
  ((select id from public.categories where slug = 'salad-sides'),
   'salade-cesar', 'Salade César sauce maison',
   null, 6000, null, 10, false),

  ((select id from public.categories where slug = 'salad-sides'),
   'frites-maison', 'Frites maison',
   null, 2500, '/photos/frites-maison.jpg', 20, false),

  ((select id from public.categories where slug = 'salad-sides'),
   'frites-patates-douces', 'Frites de patates douces',
   null, 3000, '/photos/frites-patates-douces.jpg', 30, false),

  ((select id from public.categories where slug = 'salad-sides'),
   'cheesy-frites', 'Cheesy frites',
   'Frites maison, sauce fromagère', 3000, null, 40, false),

  ((select id from public.categories where slug = 'salad-sides'),
   'cheesy-bacon-frites', 'Cheesy bacon frites',
   'Frites maison, sauce fromagère, bacon de bœuf', 5000,
   '/photos/cheesy-bacon-frites.jpg', 50, false),

  -- DESSERTS
  ((select id from public.categories where slug = 'desserts'),
   'beignets', 'Beignets',
   'Au choix : nutella, sucre ou miel', 4000, null, 10, false),

  ((select id from public.categories where slug = 'desserts'),
   'soft-serve', 'Soft serve',
   null, 4500, null, 20, false),

  -- DRINKS
  ((select id from public.categories where slug = 'drinks'),
   'soda', 'Soda', null, 2000, null, 10, false),

  ((select id from public.categories where slug = 'drinks'),
   'milkshake', 'Milkshake', null, 4500, null, 20, false)
on conflict (slug) do nothing;

-- ------------------------------------------------------------------- options
do $$
declare
  v_opt uuid;
  v_prod uuid;
  v_slug text;
begin
  -- Suppléments, communs aux quatre burgers.
  foreach v_slug in array array['cheeseburger','double-cheeseburger','home-made-burger','burger-du-mois']
  loop
    select id into v_prod from public.products where slug = v_slug;

    insert into public.product_options (product_id, name, type, is_required, sort_order)
    values (v_prod, 'Suppléments', 'multi', false, 10)
    returning id into v_opt;

    insert into public.product_option_values (option_id, name, price_delta_cents, sort_order) values
      (v_opt, 'Sauce maison supplémentaire', 1200, 10),
      (v_opt, 'Cheddar supplémentaire',      1000, 20),
      (v_opt, 'Bacon de bœuf',               1500, 30),
      (v_opt, 'Steak supplémentaire',        2500, 40);

    insert into public.product_options (product_id, name, type, is_required, sort_order)
    values (v_prod, 'Sans', 'multi', false, 20)
    returning id into v_opt;

    insert into public.product_option_values (option_id, name, price_delta_cents, sort_order) values
      (v_opt, 'Sans oignons',  0, 10),
      (v_opt, 'Sans pickles',  0, 20),
      (v_opt, 'Sans sauce',    0, 30);
  end loop;

  -- Beignets : le parfum est un choix obligatoire, sans supplément.
  select id into v_prod from public.products where slug = 'beignets';
  insert into public.product_options (product_id, name, type, is_required, sort_order)
  values (v_prod, 'Parfum', 'single', true, 10)
  returning id into v_opt;
  insert into public.product_option_values (option_id, name, price_delta_cents, sort_order) values
    (v_opt, 'Nutella', 0, 10),
    (v_opt, 'Sucre',   0, 20),
    (v_opt, 'Miel',    0, 30);

  select id into v_prod from public.products where slug = 'soft-serve';
  insert into public.product_options (product_id, name, type, is_required, sort_order)
  values (v_prod, 'Parfum', 'single', true, 10)
  returning id into v_opt;
  insert into public.product_option_values (option_id, name, price_delta_cents, sort_order) values
    (v_opt, 'Vanille',  0, 10),
    (v_opt, 'Chocolat', 0, 20);

  select id into v_prod from public.products where slug = 'milkshake';
  insert into public.product_options (product_id, name, type, is_required, sort_order)
  values (v_prod, 'Parfum', 'single', true, 10)
  returning id into v_opt;
  insert into public.product_option_values (option_id, name, price_delta_cents, sort_order) values
    (v_opt, 'Vanille',  0, 10),
    (v_opt, 'Chocolat', 0, 20),
    (v_opt, 'Fraise',   0, 30),
    (v_opt, 'Oreo',     0, 40);

  select id into v_prod from public.products where slug = 'soda';
  insert into public.product_options (product_id, name, type, is_required, sort_order)
  values (v_prod, 'Boisson', 'single', true, 10)
  returning id into v_opt;
  insert into public.product_option_values (option_id, name, price_delta_cents, sort_order) values
    (v_opt, 'Coca',      0, 10),
    (v_opt, 'Coca zéro', 0, 20),
    (v_opt, 'Fanta',     0, 30),
    (v_opt, 'Sprite',    0, 40),
    (v_opt, 'Eau',       0, 50);
end;
$$;
