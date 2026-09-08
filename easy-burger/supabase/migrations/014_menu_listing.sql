-- =============================================================================
-- Easy Burger — 014_menu_listing
-- -----------------------------------------------------------------------------
-- Retirer un produit de la carte n'est pas la même chose que le mettre en
-- rupture. « Épuisé » se dit au client et revient demain ; « retiré » ne
-- s'affiche pas du tout.
--
-- Deux colonnes plutôt qu'une suppression : ce qui est retiré se remet en un
-- clic depuis le back-office, sans repasser par une migration.
-- =============================================================================

alter table public.products
  add column is_listed boolean not null default true;

comment on column public.products.is_listed is
  'Présent sur la carte. À distinguer de is_available, qui est la rupture du jour.';

-- Retirés de la carte pour le moment, sur décision du restaurant.
update public.products set is_listed = false
 where slug in ('salade-cesar', 'milkshake');

-- La récompense « Milkshake ou soft serve » pointait sur le milkshake, qui
-- n'est plus à la carte : elle bascule sur le soft serve.
update public.rewards
   set title = 'Soft serve',
       product_id = (select id from public.products where slug = 'soft-serve')
 where slug = 'milkshake';
