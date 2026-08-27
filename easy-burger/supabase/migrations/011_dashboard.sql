-- =============================================================================
-- Easy Burger — 011_dashboard
-- -----------------------------------------------------------------------------
-- §10 — le tableau de bord. Agrégé en base plutôt qu'en TypeScript : une
-- requête au lieu de huit, et les chiffres restent cohérents entre eux parce
-- qu'ils sont calculés sur le même instantané.
-- =============================================================================

create or replace function public.dashboard_stats(
  p_from date default current_date,
  p_to   date default current_date
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_from timestamptz := p_from::timestamptz;
  v_to   timestamptz := (p_to + 1)::timestamptz;
  v_res  jsonb;
begin
  if not public.is_at_least('manager') then
    raise exception 'Accès refusé' using errcode = 'insufficient_privilege';
  end if;

  select jsonb_build_object(
    'orders',        coalesce(o.orders, 0),
    'completed',     coalesce(o.completed, 0),
    'cancelled',     coalesce(o.cancelled, 0),
    'revenue_cents', coalesce(o.revenue, 0),
    -- Panier moyen sur les commandes encaissées : inclure les annulées
    -- donnerait un chiffre flatteur et faux.
    'avg_basket_cents', case when coalesce(o.completed, 0) > 0
                             then (o.revenue / o.completed)::int else 0 end,
    'delivery_share', case when coalesce(o.completed, 0) > 0
                           then round(100.0 * o.delivery / o.completed) else 0 end,

    'new_customers', coalesce(c.new_customers, 0),
    'identified_customers', coalesce(c.identified, 0),

    'points_earned',   coalesce(l.earned, 0),
    'points_redeemed', coalesce(l.redeemed, 0),
    'points_expired',  coalesce(l.expired, 0),
    -- Ce que les points utilisés ont réellement coûté en valeur menu.
    'redeemed_value_cents', coalesce(l.redeemed, 0) * 100
                            / greatest(coalesce(
                                (select (value #>> '{}')::int from public.settings
                                  where key = 'redemption_rate'), 10), 1),

    'counter_tickets', coalesce(t.tickets, 0),
    'counter_identified', coalesce(t.identified, 0),
    -- §11.2 : l'indicateur de succès du programme.
    'identification_rate', case when coalesce(t.tickets, 0) > 0
                                then round(100.0 * t.identified / t.tickets) else null end
  )
  into v_res
  from
    (select count(*) filter (where true)                          as orders,
            count(*) filter (where status = 'completed')           as completed,
            count(*) filter (where status = 'cancelled')           as cancelled,
            coalesce(sum(total_cents) filter (where status = 'completed'), 0) as revenue,
            count(*) filter (where status = 'completed' and mode = 'delivery') as delivery
       from public.orders
      where placed_at >= v_from and placed_at < v_to) o,
    (select count(*) as new_customers,
            count(*) filter (where first_name is not null) as identified
       from public.customers
      where created_at >= v_from and created_at < v_to) c,
    (select coalesce(sum(points) filter (where points > 0), 0)  as earned,
            coalesce(-sum(points) filter (where type = 'redeem'), 0) as redeemed,
            coalesce(-sum(points) filter (where type = 'expire'), 0) as expired
       from public.loyalty_transactions
      where created_at >= v_from and created_at < v_to) l,
    (select count(*) as tickets,
            count(*) filter (where exists (
              select 1 from public.loyalty_transactions lt
               where lt.source = 'pos_ticket' and lt.source_ref = pt.ticket_ref
            )) as identified
       from public.pos_tickets pt
      where pt.ticket_date >= p_from and pt.ticket_date <= p_to) t;

  return v_res;
end;
$$;

/**
 * §11.2 — le taux d'identification par caissier.
 *
 * « Le personnel oubliera de demander le numéro. » Ce tableau est ce qui
 * rend cet oubli visible, caissier par caissier.
 */
create or replace function public.cashier_stats(
  p_from date default current_date - 30,
  p_to   date default current_date
)
returns table (
  staff_id      uuid,
  name          text,
  credits       bigint,
  points        bigint,
  amount_cents  bigint,
  last_credit   timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select s.id,
         s.name,
         count(t.id),
         coalesce(sum(t.points), 0),
         coalesce(sum(t.amount_cents), 0),
         max(t.created_at)
    from public.staff_users s
    left join public.loyalty_transactions t
      on t.created_by = s.id
     and t.source = 'pos_ticket'
     and t.created_at >= p_from::timestamptz
     and t.created_at < (p_to + 1)::timestamptz
   where public.is_at_least('manager')
   group by s.id, s.name
   order by count(t.id) desc;
$$;

revoke all on function public.dashboard_stats(date, date) from public;
revoke all on function public.cashier_stats(date, date)   from public;
grant execute on function public.dashboard_stats(date, date) to authenticated;
grant execute on function public.cashier_stats(date, date)   to authenticated;
