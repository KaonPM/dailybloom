-- Learner registration and recurring school-fee billing.
-- This ledger is separate from DailyBloom's platform subscription ledger.

alter table public.learners
  add column if not exists monthly_fee numeric(12,2) not null default 0
    check (monthly_fee >= 0),
  add column if not exists fee_billing_start_date date,
  add column if not exists registration_fee_amount numeric(12,2) not null default 0
    check (registration_fee_amount >= 0),
  add column if not exists registration_fee_paid_at date,
  add column if not exists registration_fee_payment_method text,
  add column if not exists registration_fee_reference text;

create or replace function public.prepare_learner_fee_profile()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.fee_billing_start_date is null then
    new.fee_billing_start_date :=
      (date_trunc('month', current_date) + interval '1 month')::date;
  end if;
  return new;
end;
$$;

drop trigger if exists prepare_learner_fee_profile_trigger on public.learners;
create trigger prepare_learner_fee_profile_trigger
before insert or update of fee_billing_start_date on public.learners
for each row
execute function public.prepare_learner_fee_profile();

create or replace function public.record_paid_learner_registration_fee()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  charge_id_value bigint;
  payment_id_value bigint;
  receipt_value text;
begin
  if new.registration_fee_paid_at is null
     or coalesce(new.registration_fee_amount, 0) <= 0
     or (tg_op = 'UPDATE' and old.registration_fee_paid_at is not null) then
    return new;
  end if;

  insert into public.learner_fee_charges (
    school_id, learner_id, charge_type, description, billing_period,
    due_date, amount, created_by
  )
  values (
    new.school_id, new.id, 'registration_fee', 'Registration fee',
    new.registration_fee_paid_at, new.registration_fee_paid_at,
    new.registration_fee_amount, auth.uid()
  )
  on conflict (school_id, learner_id, charge_type, billing_period)
  do update set amount = excluded.amount
  returning id into charge_id_value;

  receipt_value :=
    'PS-REG-' || to_char(new.registration_fee_paid_at, 'YYYYMMDD')
    || '-' || new.school_id::text || '-'
    || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));

  insert into public.learner_fee_payments (
    school_id, learner_id, amount, payment_date, payment_method,
    reference_number, receipt_number, recorded_by
  )
  values (
    new.school_id, new.id, new.registration_fee_amount,
    new.registration_fee_paid_at,
    coalesce(nullif(trim(new.registration_fee_payment_method), ''), 'Not specified'),
    nullif(trim(new.registration_fee_reference), ''),
    receipt_value, auth.uid()
  )
  returning id into payment_id_value;

  insert into public.learner_fee_allocations (payment_id, charge_id, amount)
  values (payment_id_value, charge_id_value, new.registration_fee_amount)
  on conflict (payment_id, charge_id) do nothing;

  insert into public.payments (
    learner_name,
    amount,
    payment_date,
    status,
    school_id,
    payment_month,
    payment_year,
    parent_phone,
    payment_method,
    reference_number
  )
  values (
    new.name,
    new.registration_fee_amount,
    new.registration_fee_paid_at,
    'paid',
    new.school_id,
    extract(month from new.registration_fee_paid_at)::integer,
    extract(year from new.registration_fee_paid_at)::integer,
    new.parent_phone,
    coalesce(nullif(trim(new.registration_fee_payment_method), ''), 'Not specified'),
    coalesce(nullif(trim(new.registration_fee_reference), ''), receipt_value)
  );

  return new;
end;
$$;

drop trigger if exists record_paid_learner_registration_fee_trigger on public.learners;
create trigger record_paid_learner_registration_fee_trigger
after insert or update of registration_fee_paid_at on public.learners
for each row
execute function public.record_paid_learner_registration_fee();

create or replace function public.generate_learner_monthly_fee_charges(
  target_date date default current_date
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  month_start date := date_trunc('month', target_date)::date;
  inserted_count integer := 0;
begin
  insert into public.learner_fee_charges (
    school_id, learner_id, charge_type, description, billing_period,
    due_date, amount
  )
  select
    learner.school_id,
    learner.id,
    'monthly_fee',
    'School fees - ' || to_char(month_start, 'FMMonth YYYY'),
    month_start,
    month_start,
    learner.monthly_fee
  from public.learners learner
  where coalesce(learner.is_deleted, false) = false
    and learner.school_id is not null
    and learner.monthly_fee > 0
    and learner.fee_billing_start_date <= month_start
  on conflict (school_id, learner_id, charge_type, billing_period)
  do nothing;

  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;

revoke all on function public.generate_learner_monthly_fee_charges(date)
  from public;
grant execute on function public.generate_learner_monthly_fee_charges(date)
  to service_role;
