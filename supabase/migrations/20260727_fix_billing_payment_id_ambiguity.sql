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
  recorded_payment_id bigint;
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

  repair_result := public.reconcile_school_billing_account(target_school_id, 599);

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
  returning id into recorded_payment_id;

  repair_result := public.reconcile_school_billing_account(target_school_id, 599);

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
  where payment.id = recorded_payment_id;

  select coalesce(sum(invoice.balance_due), 0)
  into outstanding_total
  from public.billing_invoices invoice
  where invoice.school_id = target_school_id
    and invoice.status in ('issued', 'partially_paid');

  select allocation.invoice_id, invoice.download_token
  into first_invoice_id, first_invoice_token
  from public.billing_payment_allocations allocation
  join public.billing_invoices invoice on invoice.id = allocation.invoice_id
  where allocation.payment_id = recorded_payment_id
  order by invoice.issue_date asc, allocation.id asc
  limit 1;

  return jsonb_build_object(
    'payment_id', recorded_payment_id,
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
