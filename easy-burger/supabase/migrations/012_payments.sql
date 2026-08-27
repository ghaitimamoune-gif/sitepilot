-- =============================================================================
-- Easy Burger — 012_payments
-- -----------------------------------------------------------------------------
-- §12 — trois règles, et elles tiennent toutes ici :
--
--   1. On ne stocke JAMAIS un numéro de carte. Seulement un jeton renvoyé
--      par le prestataire. Aucune donnée carte ne transite par cette base.
--   2. Le statut de paiement est confirmé par callback serveur, jamais par
--      le retour navigateur du client — celui-ci se falsifie d'un clic.
--   3. Toute commande a un état de paiement explicite et récupérable en cas
--      d'interruption.
-- =============================================================================

create type public.payment_event_status as enum (
  'created',    -- intention enregistrée, client envoyé chez le prestataire
  'authorized', -- autorisé, pas encore capturé
  'paid',
  'failed',
  'refunded',
  'expired'
);

create table public.payments (
  id            uuid primary key default gen_random_uuid(),
  order_id      uuid not null references public.orders (id) on delete cascade,
  -- Nom du prestataire. Le code métier ne le lit jamais : il ne sert qu'au
  -- routage du callback et au support.
  provider      text not null,
  -- Référence côté prestataire. Unique par prestataire : un même callback
  -- rejoué ne crée pas une seconde ligne.
  provider_ref  text,
  status        public.payment_event_status not null default 'created',
  amount_cents  int  not null check (amount_cents >= 0),
  -- Jeton de carte enregistrée, quand le prestataire en fournit un (§12 :
  -- c'est ce qui permettra le paiement en un tap). JAMAIS un numéro.
  card_token    text,
  card_last4    text check (card_last4 ~ '^[0-9]{4}$'),
  card_brand    text,
  failure_reason text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create unique index payments_provider_ref_idx
  on public.payments (provider, provider_ref)
  where provider_ref is not null;

create index payments_order_idx on public.payments (order_id, created_at desc);

create trigger payments_touch_updated_at
  before update on public.payments
  for each row execute function public.touch_updated_at();

comment on table public.payments is
  'Journal des paiements. Ne contient jamais de donnée carte : seulement un '
  'jeton, les quatre derniers chiffres et la marque, tels que renvoyés par '
  'le prestataire.';

-- Un garde-fou, parce que la règle est trop importante pour reposer sur la
-- vigilance : un jeton qui ressemble à un PAN est refusé à l'écriture.
create or replace function public.payments_reject_pan()
returns trigger
language plpgsql
as $$
begin
  if new.card_token is not null
     and regexp_replace(new.card_token, '\D', '', 'g') ~ '^[0-9]{13,19}$' then
    raise exception 'Le jeton ressemble à un numéro de carte. On ne stocke jamais de PAN (§12).'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger payments_reject_pan
  before insert or update on public.payments
  for each row execute function public.payments_reject_pan();

insert into public.settings (key, value, label, is_public) values
  ('payment_provider', to_jsonb('cash'::text),
   'Prestataire de paiement actif : cash, payzone ou cmi (§12)', true)
on conflict (key) do nothing;

/**
 * Enregistre l'intention de paiement d'une commande.
 * Appelée par la couche serveur au moment du checkout.
 */
create or replace function public.create_payment(
  p_order_id uuid,
  p_provider text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.orders%rowtype;
  v_id    uuid;
begin
  select * into v_order from public.orders where id = p_order_id;
  if not found then
    raise exception 'Commande introuvable';
  end if;

  insert into public.payments (order_id, provider, amount_cents, status)
  values (p_order_id, p_provider, v_order.total_cents, 'created')
  returning id into v_id;

  return jsonb_build_object('payment_id', v_id, 'amount_cents', v_order.total_cents);
end;
$$;

/**
 * Applique un callback de prestataire.
 *
 * Idempotente : le même `provider_ref` avec le même statut peut arriver dix
 * fois — les prestataires réessaient — sans rien changer ni rien doubler.
 * C'est ici, et nulle part ailleurs, que le paiement d'une commande devient
 * vrai.
 */
create or replace function public.apply_payment_callback(
  p_provider     text,
  p_provider_ref text,
  p_status       public.payment_event_status,
  p_payment_id   uuid default null,
  p_card_token   text default null,
  p_card_last4   text default null,
  p_card_brand   text default null,
  p_failure      text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_payment public.payments%rowtype;
begin
  -- On retrouve le paiement par son identifiant interne quand on l'a
  -- transmis au prestataire, sinon par la référence qu'il nous renvoie.
  if p_payment_id is not null then
    select * into v_payment from public.payments where id = p_payment_id for update;
  else
    select * into v_payment from public.payments
     where provider = p_provider and provider_ref = p_provider_ref for update;
  end if;

  if not found then
    raise exception 'Paiement introuvable' using errcode = 'no_data_found';
  end if;

  -- Un paiement déjà réglé ne redevient pas « échoué » parce qu'un callback
  -- en retard arrive après coup.
  if v_payment.status in ('paid', 'refunded') and p_status <> 'refunded' then
    return jsonb_build_object('status', v_payment.status, 'changed', false);
  end if;

  update public.payments
     set provider_ref    = coalesce(p_provider_ref, provider_ref),
         status          = p_status,
         card_token      = coalesce(p_card_token, card_token),
         card_last4      = coalesce(p_card_last4, card_last4),
         card_brand      = coalesce(p_card_brand, card_brand),
         failure_reason  = p_failure
   where id = v_payment.id;

  update public.orders
     set payment_status = case p_status
                            when 'paid'     then 'paid'::public.payment_status
                            when 'refunded' then 'refunded'::public.payment_status
                            when 'failed'   then 'failed'::public.payment_status
                            when 'expired'  then 'failed'::public.payment_status
                            else payment_status
                          end
   where id = v_payment.order_id;

  perform public.write_audit(
    'payment.callback', 'payments', v_payment.id::text,
    jsonb_build_object('provider', p_provider, 'status', p_status, 'ref', p_provider_ref)
  );

  return jsonb_build_object('status', p_status, 'changed', true,
                            'order_id', v_payment.order_id);
end;
$$;

alter table public.payments enable row level security;

create policy payments_read_staff on public.payments for select
  using (public.is_at_least('manager'));

-- Le client ne lit pas la table des paiements : l'état qui le concerne est
-- sur sa commande. Aucune policy d'écriture nulle part.
revoke insert, update, delete on public.payments from anon, authenticated;

revoke all on function public.create_payment(uuid, text) from public;
revoke all on function public.apply_payment_callback(
  text, text, public.payment_event_status, uuid, text, text, text, text) from public;
