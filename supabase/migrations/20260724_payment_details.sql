-- Preserve the business context selected when a DailyBloom payment is recorded.

alter table public.subscription_payments
  add column if not exists charge_type text
    check (charge_type in ('setup_fee', 'subscription')),
  add column if not exists plan_name text;

create index if not exists subscription_payments_school_type_date_idx
  on public.subscription_payments (school_id, charge_type, payment_date desc);

comment on column public.subscription_payments.charge_type is
  'The selected charge category: setup fee or subscription fee.';
comment on column public.subscription_payments.plan_name is
  'Snapshot of the DailyBloom package when the payment was recorded.';
