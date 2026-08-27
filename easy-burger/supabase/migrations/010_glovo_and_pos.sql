-- =============================================================================
-- Easy Burger — 010_glovo_and_pos
-- -----------------------------------------------------------------------------
-- §6.4c les codes de sac Glovo, §11.3 la réclamation par ticket.
--
-- Rien ici ne dépend d'une API Lacaisse. L'import des ventes se fait par
-- fichier, ce que toute caisse sait produire. Si une API arrive un jour, elle
-- remplacera l'import sans toucher au reste.
-- =============================================================================

insert into public.settings (key, value, label, is_public) values
  ('ticket_claim_days', to_jsonb(7),
   'Fenêtre de réclamation d''un ticket, en jours (§11.3)', true)
on conflict (key) do nothing;

-- =============================================================================
-- Codes de sac Glovo — la machine à convertir les clients de la marketplace
-- =============================================================================
create type public.claim_code_status as enum ('unused', 'redeemed', 'void');

create table public.claim_codes (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,
  batch       text not null,
  points      int  not null check (points > 0),
  status      public.claim_code_status not null default 'unused',
  redeemed_by uuid references public.customers (id) on delete set null,
  redeemed_at timestamptz,
  created_at  timestamptz not null default now()
);

create index claim_codes_batch_idx on public.claim_codes (batch, status);

/**
 * Code alphanumérique de 8 caractères, sans les glyphes qu'on confond
 * (0/O, 1/I/L). Un client qui recopie un sticker à la main ne doit pas
 * échouer parce que la police est ambiguë.
 */
create or replace function public.new_claim_code()
returns text
language plpgsql
as $$
declare
  v_alphabet constant text := '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  v_code text;
  v_try  int := 0;
begin
  loop
    v_code := '';
    for i in 1..8 loop
      v_code := v_code || substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::int, 1);
    end loop;

    exit when not exists (select 1 from public.claim_codes where code = v_code);
    v_try := v_try + 1;
    if v_try > 50 then
      raise exception 'Impossible de générer un code libre';
    end if;
  end loop;
  return v_code;
end;
$$;

/** Génération d'un lot, depuis le back-office (§10). */
create or replace function public.generate_claim_codes(
  p_batch  text,
  p_count  int,
  p_points int
)
returns setof text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_code text;
begin
  if not public.is_at_least('manager') then
    raise exception 'Accès refusé' using errcode = 'insufficient_privilege';
  end if;

  if coalesce(p_count, 0) not between 1 and 2000 then
    raise exception 'Un lot compte entre 1 et 2000 codes' using errcode = 'check_violation';
  end if;

  if coalesce(p_points, 0) <= 0 then
    raise exception 'Indique un nombre de points positif' using errcode = 'check_violation';
  end if;

  for i in 1..p_count loop
    v_code := public.new_claim_code();
    insert into public.claim_codes (code, batch, points) values (v_code, trim(p_batch), p_points);
    return next v_code;
  end loop;

  perform public.write_audit(
    'claim_codes.generate', 'claim_codes', trim(p_batch),
    jsonb_build_object('count', p_count, 'points', p_points)
  );
end;
$$;

/**
 * §6.4c — le client scanne le sticker, saisit son numéro, récupère ses points.
 *
 * Appelable sans compte : le sticker est physique, il est dans le sac du
 * client. L'unicité tient au code, pas à l'identité.
 */
create or replace function public.claim_glovo_code(p_code text, p_phone text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_code     public.claim_codes%rowtype;
  v_phone    text;
  v_customer uuid;
  v_created  boolean := false;
begin
  v_phone := public.normalize_phone(p_phone);
  if v_phone is null then
    raise exception 'Numéro de téléphone inexploitable' using errcode = 'check_violation';
  end if;

  select * into v_code
    from public.claim_codes
   where code = upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'))
   for update;

  if not found then
    raise exception 'Code inconnu. Vérifie le sticker sur ton sac.'
      using errcode = 'no_data_found';
  end if;

  if v_code.status <> 'unused' then
    raise exception 'Ce code a déjà été utilisé.' using errcode = 'unique_violation';
  end if;

  select id into v_customer from public.customers where phone = v_phone;
  if not found then
    insert into public.customers (phone) values (v_phone) returning id into v_customer;
    v_created := true;
  end if;

  -- L'unicité par (source, source_ref) fait le reste : même si deux requêtes
  -- passaient le verrou, la seconde échouerait ici.
  insert into public.loyalty_transactions (
    customer_id, type, source, source_ref, points, expires_at, note
  ) values (
    v_customer, 'bonus', 'glovo_code', v_code.code, v_code.points,
    public.points_expiry_at(), 'Code sac ' || v_code.batch
  );

  update public.claim_codes
     set status = 'redeemed', redeemed_by = v_customer, redeemed_at = now()
   where id = v_code.id;

  return jsonb_build_object(
    'points', v_code.points,
    'phone', v_phone,
    'customer_created', v_created,
    'new_balance', (select points_balance from public.customers where id = v_customer)
  );
end;
$$;

-- =============================================================================
-- §11.3 — réclamation par ticket, le filet de sécurité
-- -----------------------------------------------------------------------------
-- Pour le client qui a oublié de donner son numéro au comptoir. Il saisit le
-- numéro de ticket, le montant et la date ; le crédit part en attente. Chaque
-- nuit, l'export des ventes est importé et rapproché.
-- =============================================================================
create table public.pos_tickets (
  id           uuid primary key default gen_random_uuid(),
  ticket_ref   text not null unique,
  amount_cents int  not null check (amount_cents >= 0),
  ticket_date  date not null,
  source       text not null default 'import',
  imported_at  timestamptz not null default now()
);

create index pos_tickets_date_idx on public.pos_tickets (ticket_date);

create type public.pos_claim_status as enum ('pending', 'matched', 'rejected');

create table public.pos_claims (
  id                uuid primary key default gen_random_uuid(),
  customer_id       uuid not null references public.customers (id) on delete cascade,
  ticket_ref        text not null,
  amount_cents      int  not null check (amount_cents > 0),
  ticket_date       date not null,
  status            public.pos_claim_status not null default 'pending',
  matched_ticket_id uuid references public.pos_tickets (id) on delete set null,
  reject_reason     text,
  created_at        timestamptz not null default now(),
  resolved_at       timestamptz
);

-- §11.3 : « un ticket ne peut être réclamé qu'une seule fois ». La contrainte
-- couvre aussi les réclamations en attente : deux clients ne peuvent pas
-- réclamer le même ticket en espérant que l'un des deux passe.
create unique index pos_claims_one_per_ticket_idx
  on public.pos_claims (ticket_ref)
  where status in ('pending', 'matched');

create index pos_claims_customer_idx on public.pos_claims (customer_id, created_at desc);

/** Normalisation commune : « A-1042 », « a 1042 » et « A1042 » sont un seul ticket. */
create or replace function public.normalize_ticket_ref(raw text)
returns text
language sql
immutable
as $$
  select nullif(upper(regexp_replace(coalesce(raw, ''), '[^A-Za-z0-9]', '', 'g')), '');
$$;

/** Le client réclame un ticket. Le crédit reste en attente jusqu'au rapprochement. */
create or replace function public.submit_pos_claim(
  p_ticket_ref   text,
  p_amount_cents int,
  p_ticket_date  date
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_customer public.customers%rowtype;
  v_ref      text;
  v_days     int;
  v_id       uuid;
begin
  select * into v_customer from public.customers where auth_user_id = auth.uid();
  if not found then
    raise exception 'Connecte-toi pour réclamer un ticket'
      using errcode = 'insufficient_privilege';
  end if;

  v_ref := public.normalize_ticket_ref(p_ticket_ref);
  if v_ref is null then
    raise exception 'Indique le numéro du ticket' using errcode = 'check_violation';
  end if;

  if coalesce(p_amount_cents, 0) <= 0 then
    raise exception 'Indique le montant du ticket' using errcode = 'check_violation';
  end if;

  select coalesce((value #>> '{}')::int, 7) into v_days
    from public.settings where key = 'ticket_claim_days';

  if p_ticket_date is null
     or p_ticket_date > current_date
     or p_ticket_date < current_date - v_days then
    raise exception 'Un ticket se réclame dans les % jours qui suivent l''achat', v_days
      using errcode = 'check_violation';
  end if;

  -- Le ticket a peut-être déjà été crédité au comptoir : inutile de faire
  -- patienter le client jusqu'à la nuit pour lui dire non.
  if exists (
    select 1 from public.loyalty_transactions
     where source = 'pos_ticket' and source_ref = v_ref
  ) then
    raise exception 'Ce ticket a déjà été crédité.' using errcode = 'unique_violation';
  end if;

  begin
    insert into public.pos_claims (customer_id, ticket_ref, amount_cents, ticket_date)
    values (v_customer.id, v_ref, p_amount_cents, p_ticket_date)
    returning id into v_id;
  exception when unique_violation then
    raise exception 'Ce ticket a déjà été réclamé.' using errcode = 'unique_violation';
  end;

  return jsonb_build_object('id', v_id, 'ticket_ref', v_ref, 'status', 'pending');
end;
$$;

/** Import de l'export de ventes. Un tableau d'objets {ref, amount_cents, date}. */
create or replace function public.import_pos_tickets(p_rows jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_row      jsonb;
  v_ref      text;
  v_inserted int := 0;
  v_skipped  int := 0;
begin
  if not public.is_at_least('manager') then
    raise exception 'Accès refusé' using errcode = 'insufficient_privilege';
  end if;

  for v_row in select * from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb))
  loop
    v_ref := public.normalize_ticket_ref(v_row->>'ref');
    if v_ref is null then
      v_skipped := v_skipped + 1;
      continue;
    end if;

    begin
      insert into public.pos_tickets (ticket_ref, amount_cents, ticket_date)
      values (v_ref, (v_row->>'amount_cents')::int, (v_row->>'date')::date);
      v_inserted := v_inserted + 1;
    exception when unique_violation or invalid_text_representation or null_value_not_allowed then
      -- Un même export réimporté ne doit pas doubler les lignes, et une
      -- ligne illisible ne doit pas faire échouer tout le fichier.
      v_skipped := v_skipped + 1;
    end;
  end loop;

  perform public.write_audit(
    'pos_tickets.import', 'pos_tickets', null,
    jsonb_build_object('inserted', v_inserted, 'skipped', v_skipped)
  );

  return jsonb_build_object('inserted', v_inserted, 'skipped', v_skipped);
end;
$$;

/**
 * Rapproche les réclamations en attente avec les tickets importés.
 * Ticket trouvé + montant correspondant + non déjà crédité → crédit confirmé.
 * Sinon → rejet motivé.
 */
create or replace function public.reconcile_pos_claims()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_claim    record;
  v_ticket   public.pos_tickets%rowtype;
  v_matched  int := 0;
  v_rejected int := 0;
  v_days     int;
begin
  select coalesce((value #>> '{}')::int, 7) into v_days
    from public.settings where key = 'ticket_claim_days';

  for v_claim in
    select * from public.pos_claims where status = 'pending' for update
  loop
    select * into v_ticket from public.pos_tickets where ticket_ref = v_claim.ticket_ref;

    if not found then
      -- Tant que la fenêtre court, l'export du jour peut encore arriver.
      if v_claim.created_at < now() - make_interval(days => v_days) then
        update public.pos_claims
           set status = 'rejected', reject_reason = 'Ticket introuvable dans les ventes',
               resolved_at = now()
         where id = v_claim.id;
        v_rejected := v_rejected + 1;
      end if;
      continue;
    end if;

    if v_ticket.amount_cents <> v_claim.amount_cents then
      update public.pos_claims
         set status = 'rejected', reject_reason = 'Le montant ne correspond pas au ticket',
             resolved_at = now()
       where id = v_claim.id;
      v_rejected := v_rejected + 1;
      continue;
    end if;

    begin
      insert into public.loyalty_transactions (
        customer_id, type, source, source_ref, points, amount_cents, expires_at, note
      ) values (
        v_claim.customer_id, 'earn', 'pos_ticket', v_claim.ticket_ref,
        public.points_for_amount(v_ticket.amount_cents), v_ticket.amount_cents,
        public.points_expiry_at(), 'Ticket réclamé'
      );
    exception when unique_violation then
      -- Le ticket a été crédité au comptoir entre-temps.
      update public.pos_claims
         set status = 'rejected', reject_reason = 'Ticket déjà crédité au comptoir',
             resolved_at = now()
       where id = v_claim.id;
      v_rejected := v_rejected + 1;
      continue;
    end;

    update public.pos_claims
       set status = 'matched', matched_ticket_id = v_ticket.id, resolved_at = now()
     where id = v_claim.id;
    v_matched := v_matched + 1;
  end loop;

  return jsonb_build_object('matched', v_matched, 'rejected', v_rejected);
end;
$$;

-- ------------------------------------------------------------------------ RLS
alter table public.claim_codes enable row level security;
alter table public.pos_tickets enable row level security;
alter table public.pos_claims  enable row level security;

create policy claim_codes_read_staff on public.claim_codes for select
  using (public.is_staff());
create policy pos_tickets_read_staff on public.pos_tickets for select
  using (public.is_staff());

create policy pos_claims_read_self on public.pos_claims for select
  using (exists (
    select 1 from public.customers c
    where c.id = pos_claims.customer_id and c.auth_user_id = auth.uid()
  ));
create policy pos_claims_read_staff on public.pos_claims for select
  using (public.is_staff());

revoke insert, update, delete on public.claim_codes from anon, authenticated;
revoke insert, update, delete on public.pos_tickets from anon, authenticated;
revoke insert, update, delete on public.pos_claims  from anon, authenticated;

revoke all on function public.generate_claim_codes(text, int, int) from public;
revoke all on function public.claim_glovo_code(text, text)         from public;
revoke all on function public.submit_pos_claim(text, int, date)    from public;
revoke all on function public.import_pos_tickets(jsonb)            from public;
revoke all on function public.reconcile_pos_claims()               from public;

grant execute on function public.generate_claim_codes(text, int, int) to authenticated;
grant execute on function public.claim_glovo_code(text, text)         to anon, authenticated;
grant execute on function public.submit_pos_claim(text, int, date)    to authenticated;
grant execute on function public.import_pos_tickets(jsonb)            to authenticated;
grant execute on function public.reconcile_pos_claims()               to authenticated;
