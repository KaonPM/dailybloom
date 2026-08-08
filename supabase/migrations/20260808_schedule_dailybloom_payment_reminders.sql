-- Schedule DailyBloom subscription payment reminders through the same
-- protected daily delivery process used for preschool learner-fee reminders.
-- Existing immediate reminders are preserved as already-sent history.

alter table public.billing_payment_reminders
  add column if not exists scheduled_date date,
  add column if not exists status text,
  add column if not exists sent_at timestamptz,
  add column if not exists error_message text,
  add column if not exists retry_count integer;

update public.billing_payment_reminders
set
  scheduled_date = coalesce(scheduled_date, created_at::date),
  status = coalesce(status, 'sent'),
  sent_at = case
    when coalesce(status, 'sent') = 'sent' then coalesce(sent_at, created_at)
    else sent_at
  end,
  retry_count = coalesce(retry_count, 0);

alter table public.billing_payment_reminders
  alter column scheduled_date set default current_date,
  alter column scheduled_date set not null,
  alter column status set default 'scheduled',
  alter column status set not null,
  alter column retry_count set default 0,
  alter column retry_count set not null;

alter table public.billing_payment_reminders
  drop constraint if exists billing_payment_reminders_status_check;

alter table public.billing_payment_reminders
  add constraint billing_payment_reminders_status_check
  check (status in ('scheduled', 'sent', 'retry', 'failed'));

create index if not exists billing_payment_reminders_due_delivery_idx
  on public.billing_payment_reminders (status, scheduled_date, id);

comment on column public.billing_payment_reminders.scheduled_date is
  'The date on which the protected DailyBloom reminder process may deliver the SMS.';
