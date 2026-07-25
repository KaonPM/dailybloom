-- Transactional repair for one preschool billing account.
-- Preserves payments, recreates the expected charge schedule, and reallocates
-- payments oldest-charge-first in one database transaction.

create or replace function public.reconcile_school_billing_account(
  target_school_id bigint,
  setup_fee_value numeric default 599
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  target_school public.schools%rowtype;
  target_subscription public.school_subscriptions%rowtype;
  setup_invoice public.billing_invoices%rowtype;
  setup_on date;
  first_subscription_on date;
  billing_on date;
  invoice_row public.billing_invoices%rowtype;
  payment_row public.subscription_payments%rowtype;
  payment_remaining numeric(12,2);
  allocation_value numeric(12,2);
  created_setup boolean := false;
  created_subscriptions integer := 0;
begin
  select * into target_school
  from public.schools
  where id = target_school_id
  for update;

  if target_school.id is null then
    raise exception 'School % was not found.', target_school_id;
  end if;

  select * into target_subscription
  from public.school_subscriptions
  where school_id = target_school_id
  order by id desc
  limit 1
  for update;

  if target_subscription.id is null then
    raise exception 'School % does not have a subscription package.', target_school_id;
  end if;

  select coalesce(
    (
      select onboarding.setup_date
      from public.school_onboarding onboarding
      where onboarding.school_id = target_school_id
        and onboarding.setup_date is not null
      limit 1
    ),
    target_school.activated_at::date,
    target_school.created_at::date,
    current_date
  )
  into setup_on;

  first_subscription_on :=
    (date_trunc('month', setup_on)::date + interval '1 month')::date;

  select * into setup_invoice
  from public.billing_invoices
  where school_id = target_school_id
    and charge_type = 'setup_fee'
  order by created_at asc
  limit 1
  for update;

  if setup_invoice.id is null then
    insert into public.billing_invoices (
      school_id,
      subscription_id,
      invoice_number,
      external_key,
      charge_type,
      description,
      plan_name,
      issue_date,
      due_date,
      subtotal,
      vat_amount,
      total_amount,
      amount_paid,
      balance_due,
      status
    )
    values (
      target_school_id,
      target_subscription.id,
      'DB-' || to_char(setup_on, 'YYYYMMDD') || '-' || target_school_id ||
        '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6)),
      'setup:' || target_school_id,
      'setup_fee',
      'DailyBloom Setup Fee - ' || target_subscription.plan_name || ' Package',
      target_subscription.plan_name,
      setup_on,
      setup_on,
      setup_fee_value,
      0,
      setup_fee_value,
      0,
      setup_fee_value,
      'issued'
    )
    returning * into setup_invoice;
    created_setup := true;
  elsif setup_invoice.exempted_at is null then
    update public.billing_invoices
    set issue_date = setup_on,
        due_date = setup_on,
        plan_name = target_subscription.plan_name,
        description =
          'DailyBloom Setup Fee - ' || target_subscription.plan_name || ' Package',
        subtotal = setup_fee_value,
        total_amount = setup_fee_value,
        updated_at = now()
    where id = setup_invoice.id
    returning * into setup_invoice;
  end if;

  -- Charges before the first eligible subscription month are corrections,
  -- retained as void records for auditability.
  update public.billing_invoices
  set status = 'void',
      amount_paid = 0,
      balance_due = 0,
      updated_at = now()
  where school_id = target_school_id
    and charge_type = 'subscription'
    and status <> 'void'
    and period_start < first_subscription_on;

  billing_on := first_subscription_on;
  while billing_on <= date_trunc('month', current_date)::date loop
    insert into public.billing_invoices (
      school_id,
      subscription_id,
      invoice_number,
      external_key,
      charge_type,
      description,
      plan_name,
      issue_date,
      due_date,
      period_start,
      period_end,
      subtotal,
      vat_amount,
      total_amount,
      amount_paid,
      balance_due,
      status
    )
    values (
      target_school_id,
      target_subscription.id,
      'DB-' || to_char(billing_on, 'YYYYMMDD') || '-' || target_school_id ||
        '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6)),
      'subscription:' || target_school_id || ':' || to_char(billing_on, 'YYYY-MM'),
      'subscription',
      target_subscription.plan_name || ' Subscription Package - ' ||
        to_char(billing_on, 'FMMonth YYYY'),
      target_subscription.plan_name,
      billing_on,
      billing_on,
      billing_on,
      (billing_on + interval '1 month - 1 day')::date,
      target_subscription.monthly_price,
      0,
      target_subscription.monthly_price,
      0,
      target_subscription.monthly_price,
      'issued'
    )
    on conflict (external_key) do nothing;

    if found then
      created_subscriptions := created_subscriptions + 1;
    end if;
    billing_on := (billing_on + interval '1 month')::date;
  end loop;

  -- Rebuild allocations for this account atomically. Payments themselves and
  -- their genuine received dates are never changed.
  delete from public.billing_payment_allocations allocation
  using public.billing_invoices invoice
  where allocation.invoice_id = invoice.id
    and invoice.school_id = target_school_id;

  update public.subscription_payments
  set unapplied_amount = amount
  where school_id = target_school_id;

  update public.billing_invoices
  set amount_paid = 0,
      balance_due = total_amount,
      status = case
        when exempted_at is not null or total_amount = 0 then 'paid'
        else 'issued'
      end,
      updated_at = now()
  where school_id = target_school_id
    and status <> 'void';

  for payment_row in
    select *
    from public.subscription_payments
    where school_id = target_school_id
    order by payment_date asc, created_at asc, id asc
    for update
  loop
    payment_remaining := payment_row.amount;

    for invoice_row in
      select *
      from public.billing_invoices
      where school_id = target_school_id
        and status in ('issued', 'partially_paid')
        and balance_due > 0
      order by issue_date asc,
        case when charge_type = 'setup_fee' then 0 else 1 end,
        created_at asc
      for update
    loop
      exit when payment_remaining <= 0;
      allocation_value := least(payment_remaining, invoice_row.balance_due);

      insert into public.billing_payment_allocations (
        payment_id,
        invoice_id,
        amount
      )
      values (payment_row.id, invoice_row.id, allocation_value);

      update public.billing_invoices
      set amount_paid = amount_paid + allocation_value,
          balance_due = balance_due - allocation_value,
          status = case
            when balance_due - allocation_value <= 0 then 'paid'
            else 'partially_paid'
          end,
          updated_at = now()
      where id = invoice_row.id;

      payment_remaining := payment_remaining - allocation_value;
    end loop;

    update public.subscription_payments
    set unapplied_amount = payment_remaining
    where id = payment_row.id;
  end loop;

  update public.school_subscriptions
  set start_date = setup_on,
      next_billing_date = greatest(
        first_subscription_on,
        (date_trunc('month', current_date)::date + interval '1 month')::date
      ),
      updated_at = now()
  where id = target_subscription.id;

  return jsonb_build_object(
    'school_id', target_school_id,
    'setup_date', setup_on,
    'first_subscription_date', first_subscription_on,
    'setup_invoice_id', setup_invoice.id,
    'setup_created', created_setup,
    'subscription_invoices_created', created_subscriptions
  );
end;
$$;

revoke all on function public.reconcile_school_billing_account(bigint, numeric)
  from public, anon, authenticated;
grant execute on function public.reconcile_school_billing_account(bigint, numeric)
  to service_role;

comment on function public.reconcile_school_billing_account(bigint, numeric) is
  'Transactionally repairs one preschool billing ledger and reallocates its preserved payments oldest-charge-first.';

create or replace function public.record_school_billing_payment(
  target_school_id bigint,
  target_subscription_id bigint,
  payment_amount numeric,
  received_on date,
  payment_charge_type text,
  payment_plan_name text,
  payment_method_value text,
  payment_notes text,
  payment_receipt_number text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  payment_id bigint;
  repair_result jsonb;
  credit_total numeric(12,2);
  outstanding_total numeric(12,2);
  first_invoice_id uuid;
  first_invoice_token uuid;
begin
  if payment_amount <= 0 then
    raise exception 'Payment amount must be greater than zero.';
  end if;
  if received_on > current_date then
    raise exception 'Payment date cannot be in the future.';
  end if;
  if payment_charge_type not in ('setup_fee', 'subscription') then
    raise exception 'Payment type must be setup_fee or subscription.';
  end if;
  if not exists (
    select 1
    from public.school_subscriptions subscription
    where subscription.id = target_subscription_id
      and subscription.school_id = target_school_id
  ) then
    raise exception 'Subscription was not found for this school.';
  end if;

  repair_result := public.reconcile_school_billing_account(
    target_school_id,
    599
  );

  insert into public.subscription_payments (
    school_id,
    subscription_id,
    amount,
    unapplied_amount,
    payment_date,
    charge_type,
    plan_name,
    payment_method,
    notes,
    receipt_number
  )
  values (
    target_school_id,
    target_subscription_id,
    payment_amount,
    payment_amount,
    received_on,
    payment_charge_type,
    payment_plan_name,
    payment_method_value,
    nullif(trim(coalesce(payment_notes, '')), ''),
    payment_receipt_number
  )
  returning id into payment_id;

  repair_result := public.reconcile_school_billing_account(
    target_school_id,
    599
  );

  update public.school_subscriptions
  set status = 'active',
      last_payment_date = received_on,
      updated_at = now()
  where id = target_subscription_id;

  update public.schools
  set billing_status = 'active'
  where id = target_school_id;

  select coalesce(payment.unapplied_amount, 0)
  into credit_total
  from public.subscription_payments payment
  where payment.id = payment_id;

  select coalesce(sum(invoice.balance_due), 0)
  into outstanding_total
  from public.billing_invoices invoice
  where invoice.school_id = target_school_id
    and invoice.status in ('issued', 'partially_paid');

  select allocation.invoice_id, invoice.download_token
  into first_invoice_id, first_invoice_token
  from public.billing_payment_allocations allocation
  join public.billing_invoices invoice on invoice.id = allocation.invoice_id
  where allocation.payment_id = payment_id
  order by invoice.issue_date asc, allocation.id asc
  limit 1;

  return jsonb_build_object(
    'payment_id', payment_id,
    'receipt_number', payment_receipt_number,
    'payment_date', received_on,
    'credit_balance', coalesce(credit_total, 0),
    'outstanding_balance', coalesce(outstanding_total, 0),
    'invoice_id', first_invoice_id,
    'invoice_download_token', first_invoice_token,
    'repair', repair_result
  );
end;
$$;

revoke all on function public.record_school_billing_payment(
  bigint, bigint, numeric, date, text, text, text, text, text
) from public, anon, authenticated;
grant execute on function public.record_school_billing_payment(
  bigint, bigint, numeric, date, text, text, text, text, text
) to service_role;

comment on function public.record_school_billing_payment(
  bigint, bigint, numeric, date, text, text, text, text, text
) is
  'Records one genuine school payment and reallocates the complete billing account in one transaction.';
