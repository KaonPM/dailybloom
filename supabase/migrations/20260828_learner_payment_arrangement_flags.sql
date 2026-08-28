alter table public.learners
  add column if not exists payment_arrangement_active boolean not null default false,
  add column if not exists payment_arrangement_note text,
  add column if not exists payment_arrangement_updated_at timestamptz,
  add column if not exists payment_arrangement_updated_by uuid references auth.users(id) on delete set null;

create index if not exists learners_school_payment_arrangement_idx
  on public.learners (school_id, payment_arrangement_active)
  where payment_arrangement_active = true;

comment on column public.learners.payment_arrangement_active is
  'When true, this learner is excluded from school payment reminder messages until the arrangement is cleared.';
