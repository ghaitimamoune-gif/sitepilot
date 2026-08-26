-- =============================================================================
-- Easy Burger — 007_auth
-- -----------------------------------------------------------------------------
-- Le client obtient une vraie session (téléphone + OTP). Ce qui n'était pas
-- atteignable en Phase 1 le devient : il faut donc verrouiller ce qu'un
-- client authentifié peut écrire sur sa propre fiche.
-- =============================================================================

-- ============================ correctif de sécurité ==========================
-- La policy `customers_update_self` (003) filtre les LIGNES, pas les COLONNES.
-- Tant qu'aucun client n'avait de session, personne ne pouvait s'en servir.
-- Avec l'auth par OTP, un client pourrait écrire directement
-- `points_balance = 999999` sur sa propre fiche via l'API REST.
--
-- RLS ne sait pas restreindre une colonne : c'est le rôle des GRANT.
-- On retire donc le droit d'update global et on ne rend que les champs de
-- profil. Les soldes et compteurs restent inaccessibles en écriture, y
-- compris à leur propriétaire.
revoke update on public.customers from authenticated;
revoke update on public.customers from anon;

grant update (first_name, last_name, email, birthdate, marketing_consent, consent_at)
  on public.customers to authenticated;

-- Même logique pour le ledger. Il n'a aucune policy d'écriture, donc RLS
-- suffit aujourd'hui — mais une policy permissive ajoutée par distraction
-- dans six mois rouvrirait la porte. Le retrait du droit la garde fermée
-- quoi qu'il arrive aux policies. Les fonctions `security definer`
-- s'exécutent avec les droits du propriétaire : elles ne sont pas gênées.
revoke insert, update, delete on public.loyalty_transactions from anon, authenticated;

-- Une commande ne s'insère que par place_order.
revoke insert on public.orders             from anon, authenticated;
revoke insert on public.order_items        from anon, authenticated;
revoke insert on public.order_item_options from anon, authenticated;
-- =============================================================================

/**
 * Rattache le compte Supabase Auth courant à sa fiche client.
 *
 * Appelée juste après la vérification de l'OTP. Le numéro vient du jeton,
 * jamais du navigateur : un client ne peut pas se rattacher à la fiche de
 * quelqu'un d'autre en envoyant un autre numéro.
 */
create or replace function public.link_current_customer()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid       uuid := auth.uid();
  v_phone     text;
  v_customer  public.customers%rowtype;
begin
  if v_uid is null then
    raise exception 'Aucune session' using errcode = 'insufficient_privilege';
  end if;

  -- Le numéro fait autorité côté jeton. On accepte les deux emplacements :
  -- claim de premier niveau et user_metadata, selon la configuration du projet.
  v_phone := public.normalize_phone(coalesce(
    nullif(auth.jwt() ->> 'phone', ''),
    nullif(auth.jwt() #>> '{user_metadata,phone}', '')
  ));

  if v_phone is null then
    raise exception 'Le jeton ne porte pas de numéro de téléphone'
      using errcode = 'check_violation';
  end if;

  select * into v_customer from public.customers where phone = v_phone;

  if not found then
    insert into public.customers (phone, auth_user_id)
    values (v_phone, v_uid)
    returning * into v_customer;

  elsif v_customer.auth_user_id is null then
    -- Fiche créée au comptoir ou par une commande invité : on la rattache.
    update public.customers
       set auth_user_id = v_uid
     where id = v_customer.id
    returning * into v_customer;

  elsif v_customer.auth_user_id <> v_uid then
    -- Le numéro a déjà été vérifié par un autre compte Auth (réinscription,
    -- changement d'appareil). Le téléphone reste la clé d'identité : on
    -- bascule la fiche sur le compte qui vient de prouver le numéro.
    update public.customers
       set auth_user_id = v_uid
     where id = v_customer.id
    returning * into v_customer;
  end if;

  return jsonb_build_object(
    'id', v_customer.id,
    'phone', v_customer.phone,
    'first_name', v_customer.first_name,
    'points_balance', v_customer.points_balance,
    'orders_count', v_customer.orders_count
  );
end;
$$;

/**
 * §8 — « Prénom demandé après la première commande réussie, pas avant. »
 *
 * L'écran de suivi le demande une fois la commande passée. Le porteur du
 * jeton de suivi peut donc nommer le client de cette commande, et rien
 * d'autre : pas de session requise, pas d'autre champ modifiable.
 */
create or replace function public.name_customer_by_order_token(
  p_token uuid,
  p_name  text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_customer uuid;
  v_name     text := nullif(trim(p_name), '');
begin
  if v_name is null then
    raise exception 'Indique un prénom' using errcode = 'check_violation';
  end if;

  select customer_id into v_customer from public.orders where public_token = p_token;
  if v_customer is null then
    raise exception 'Commande introuvable';
  end if;

  -- On ne remplace jamais un prénom déjà connu : un lien de suivi partagé
  -- ne doit pas pouvoir renommer un client.
  update public.customers
     set first_name = v_name
   where id = v_customer
     and first_name is null;

  update public.orders
     set contact_name = coalesce(contact_name, v_name)
   where public_token = p_token;

  return jsonb_build_object('first_name', v_name);
end;
$$;

/**
 * §13 — suppression de compte accessible depuis l'app.
 *
 * Les commandes sont conservées pour la comptabilité, mais vidées de toute
 * donnée personnelle. Le ledger de points part avec la fiche client.
 */
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid      uuid := auth.uid();
  v_customer uuid;
begin
  if v_uid is null then
    raise exception 'Aucune session' using errcode = 'insufficient_privilege';
  end if;

  select id into v_customer from public.customers where auth_user_id = v_uid;
  if v_customer is null then
    return;
  end if;

  update public.orders
     set contact_name     = null,
         contact_phone    = null,
         address_snapshot = null,
         note             = null,
         customer_id      = null
   where customer_id = v_customer;

  -- Cascade : adresses et loyalty_transactions partent avec.
  delete from public.customers where id = v_customer;
  delete from auth.users where id = v_uid;
end;
$$;

revoke all on function public.link_current_customer()                     from public;
revoke all on function public.name_customer_by_order_token(uuid, text)    from public;
revoke all on function public.delete_my_account()                         from public;

grant execute on function public.link_current_customer()                  to authenticated;
grant execute on function public.name_customer_by_order_token(uuid, text) to anon, authenticated;
grant execute on function public.delete_my_account()                      to authenticated;

/**
 * L'écran de suivi doit savoir s'il faut demander le prénom (§8). On
 * enrichit le retour existant plutôt que d'ajouter un aller-retour.
 */
create or replace function public.get_order_by_token(p_token uuid)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'order_number', o.order_number,
    'status', o.status,
    'mode', o.mode,
    'placed_at', o.placed_at,
    'subtotal_cents', o.subtotal_cents,
    'delivery_fee_cents', o.delivery_fee_cents,
    'total_cents', o.total_cents,
    'contact_name', o.contact_name,
    'address_snapshot', o.address_snapshot,
    'note', o.note,
    -- Vrai tant que le client n'a pas de prénom : le suivi le demande alors.
    'needs_name', (c.id is not null and c.first_name is null),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'name', i.name_snapshot,
        'qty', i.qty,
        'line_total_cents', i.line_total_cents,
        'options', coalesce((
          select jsonb_agg(op.name_snapshot order by op.name_snapshot)
          from public.order_item_options op where op.order_item_id = i.id
        ), '[]'::jsonb)
      ) order by i.name_snapshot)
      from public.order_items i where i.order_id = o.id
    ), '[]'::jsonb)
  )
  from public.orders o
  left join public.customers c on c.id = o.customer_id
  where o.public_token = p_token;
$$;

revoke all on function public.get_order_by_token(uuid) from public;
grant execute on function public.get_order_by_token(uuid) to anon, authenticated;
