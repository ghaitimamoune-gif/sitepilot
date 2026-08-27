-- =============================================================================
-- Easy Burger — 013_messages
-- -----------------------------------------------------------------------------
-- §13 — les messages clients.
--
-- La mise en file se fait en base, par trigger, dans la même transaction que
-- l'événement qui la déclenche : une commande confirmée sans message en file
-- est impossible. L'envoi, lui, est fait par un adaptateur côté application —
-- SMS aujourd'hui, WhatsApp demain, sans toucher à ce fichier.
-- =============================================================================

create type public.message_channel as enum ('sms', 'whatsapp', 'push');
create type public.message_status  as enum ('pending', 'sent', 'failed', 'skipped');

create table public.messages_log (
  id          uuid primary key default gen_random_uuid(),
  customer_id uuid references public.customers (id) on delete set null,
  phone       text not null,
  channel     public.message_channel not null default 'sms',
  template    text not null,
  payload     jsonb not null default '{}'::jsonb,
  status      public.message_status not null default 'pending',
  error       text,
  -- Vrai pour un message marketing : il exige un consentement séparé (§13).
  is_marketing boolean not null default false,
  created_at  timestamptz not null default now(),
  sent_at     timestamptz
);

create index messages_log_pending_idx on public.messages_log (status, created_at)
  where status = 'pending';
create index messages_log_customer_idx on public.messages_log (customer_id, created_at desc);

-- Un même message ne part pas deux fois pour le même événement : la clé
-- d'unicité est portée par le gabarit et sa référence.
alter table public.messages_log add column dedupe_key text;
create unique index messages_log_dedupe_idx
  on public.messages_log (dedupe_key)
  where dedupe_key is not null;

/**
 * Met un message en file.
 *
 * Silencieuse par conception : un client sans téléphone exploitable, ou un
 * message marketing sans consentement, ne doit pas faire échouer la commande
 * qui l'a déclenché.
 */
create or replace function public.enqueue_message(
  p_customer_id  uuid,
  p_template     text,
  p_payload      jsonb default '{}'::jsonb,
  p_dedupe_key   text default null,
  p_is_marketing boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_customer public.customers%rowtype;
  v_id       uuid;
begin
  select * into v_customer from public.customers where id = p_customer_id;
  if not found or v_customer.phone is null then
    return null;
  end if;

  -- §13 : « le marketing viendra plus tard, et seulement vers les clients
  -- ayant donné leur accord ». Le consentement transactionnel est implicite,
  -- le consentement marketing ne l'est jamais.
  if p_is_marketing and not v_customer.marketing_consent then
    insert into public.messages_log (
      customer_id, phone, template, payload, status, is_marketing, error
    ) values (
      p_customer_id, v_customer.phone, p_template, p_payload, 'skipped', true,
      'Pas de consentement marketing'
    );
    return null;
  end if;

  begin
    insert into public.messages_log (
      customer_id, phone, template, payload, dedupe_key, is_marketing
    ) values (
      p_customer_id, v_customer.phone, p_template, p_payload, p_dedupe_key, p_is_marketing
    )
    returning id into v_id;
  exception when unique_violation then
    return null;   -- déjà en file pour cet événement
  end;

  return v_id;
end;
$$;

-- =============================================================================
-- Les déclencheurs
-- -----------------------------------------------------------------------------
-- Par trigger plutôt qu'à l'intérieur des fonctions métier : la mise en file
-- suit l'événement quoi qu'il arrive, y compris si un jour la commande change
-- de statut par un autre chemin.
-- =============================================================================

/** Confirmation de commande, puis « prête » ou « partie en livraison ». */
create or replace function public.notify_order_status()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.customer_id is null then
    return null;
  end if;

  if tg_op = 'INSERT' then
    perform public.enqueue_message(
      new.customer_id, 'order_received',
      jsonb_build_object('order_number', new.order_number, 'total_cents', new.total_cents),
      'order_received:' || new.id::text
    );
    return null;
  end if;

  if new.status is distinct from old.status then
    if new.status = 'ready' then
      perform public.enqueue_message(
        new.customer_id, 'order_ready',
        jsonb_build_object('order_number', new.order_number),
        'order_ready:' || new.id::text
      );
    elsif new.status = 'delivering' then
      perform public.enqueue_message(
        new.customer_id, 'order_delivering',
        jsonb_build_object('order_number', new.order_number),
        'order_delivering:' || new.id::text
      );
    end if;
  end if;

  return null;
end;
$$;

create trigger orders_notify_status
  after insert or update of status on public.orders
  for each row execute function public.notify_order_status();

/** Points crédités au comptoir, et code de récompense débloqué. */
create or replace function public.notify_loyalty()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- §6.4b : « le client reçoit une confirmation par message ».
  if new.source = 'pos_ticket' and new.points > 0 then
    perform public.enqueue_message(
      new.customer_id, 'points_credited',
      jsonb_build_object('points', new.points, 'ticket_ref', new.source_ref),
      'points_credited:' || new.id::text
    );
  elsif new.source = 'glovo_code' and new.points > 0 then
    perform public.enqueue_message(
      new.customer_id, 'points_credited_glovo',
      jsonb_build_object('points', new.points),
      'points_glovo:' || new.id::text
    );
  end if;

  return null;
end;
$$;

create trigger loyalty_notify
  after insert on public.loyalty_transactions
  for each row execute function public.notify_loyalty();

/** Récompense débloquée : le code part aussi par message, pas seulement à l'écran. */
create or replace function public.notify_redemption()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_title text;
begin
  select title into v_title from public.rewards where id = new.reward_id;

  perform public.enqueue_message(
    new.customer_id,
    case when new.points_spent = 0 then 'gift_granted' else 'reward_unlocked' end,
    jsonb_build_object('code', new.code, 'title', v_title, 'expires_at', new.expires_at),
    'redemption:' || new.id::text
  );

  return null;
end;
$$;

create trigger redemptions_notify
  after insert on public.reward_redemptions
  for each row execute function public.notify_redemption();

/**
 * §6.3 — alerte 30 jours avant l'expiration d'un lot de points.
 * À passer une fois par jour.
 */
create or replace function public.enqueue_expiry_warnings(p_days int default 30)
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_row   record;
  v_count int := 0;
begin
  for v_row in select * from public.points_expiring_soon(p_days)
  loop
    if public.enqueue_message(
         v_row.customer_id, 'points_expiring',
         jsonb_build_object('points', v_row.points, 'expires_on', v_row.expires_on),
         'expiring:' || v_row.customer_id::text || ':' || v_row.expires_on::text
       ) is not null then
      v_count := v_count + 1;
    end if;
  end loop;

  return v_count;
end;
$$;

/** Marque un message envoyé ou en échec. Appelée par l'adaptateur. */
create or replace function public.mark_message(
  p_id     uuid,
  p_status public.message_status,
  p_error  text default null
)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  update public.messages_log
     set status  = p_status,
         error   = p_error,
         sent_at = case when p_status = 'sent' then now() else sent_at end
   where id = p_id;
$$;

alter table public.messages_log enable row level security;

create policy messages_read_staff on public.messages_log for select
  using (public.is_at_least('admin'));

create policy messages_read_self on public.messages_log for select
  using (exists (
    select 1 from public.customers c
    where c.id = messages_log.customer_id and c.auth_user_id = auth.uid()
  ));

revoke insert, update, delete on public.messages_log from anon, authenticated;

revoke all on function public.enqueue_message(uuid, text, jsonb, text, boolean) from public;
revoke all on function public.enqueue_expiry_warnings(int) from public;
revoke all on function public.mark_message(uuid, public.message_status, text) from public;
