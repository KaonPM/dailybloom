-- Secure Parent Portal re-enrolment and SMS delivery tracking.
-- Existing learner fees, parent access and enrolment records are not changed.

alter table public.school_enrolment_enquiries
  add column if not exists registration_request_sent_at timestamptz,
  add column if not exists registration_delivery_status text,
  add column if not exists registration_provider_message_id text,
  add column if not exists registration_delivery_error text,
  add column if not exists form_sent_at timestamptz,
  add column if not exists form_delivery_status text,
  add column if not exists form_provider_message_id text,
  add column if not exists form_delivery_error text;

create table if not exists public.school_reenrolment_campaigns (
  id uuid primary key default gen_random_uuid(),
  school_id bigint not null references public.schools(id) on delete cascade,
  school_year integer not null check (school_year between 2020 and 2100),
  source_form_id uuid references public.school_enrolment_forms(id) on delete set null,
  registration_fee_type_id bigint references public.school_fee_types(id) on delete restrict,
  registration_fee_amount numeric(12,2) not null default 0 check (registration_fee_amount >= 0),
  response_deadline date,
  status text not null default 'open' check (status in ('open', 'closed')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, school_year)
);

create table if not exists public.school_reenrolment_counters (
  school_id bigint not null references public.schools(id) on delete cascade,
  school_year integer not null,
  last_number integer not null default 0 check (last_number >= 0),
  primary key (school_id, school_year)
);

create table if not exists public.learner_reenrolments (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.school_reenrolment_campaigns(id) on delete cascade,
  school_id bigint not null references public.schools(id) on delete cascade,
  learner_id uuid not null references public.learners(id) on delete cascade,
  reenrolment_reference text not null unique,
  parent_portal_phone text,
  parent_portal_phone_confirmed_at timestamptz,
  registration_fee_type_id bigint references public.school_fee_types(id) on delete restrict,
  registration_fee_amount numeric(12,2) not null default 0 check (registration_fee_amount >= 0),
  registration_payment_status text not null default 'not_required'
    check (registration_payment_status in ('not_required', 'pending', 'verified', 'waived')),
  status text not null default 'awaiting_parent'
    check (status in ('awaiting_parent', 'submitted', 'approved', 'declined', 'withdrawn')),
  submitted_data jsonb not null default '{}'::jsonb,
  notification_sent_at timestamptz,
  notification_error text,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  decline_reason text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id, learner_id)
);

create index if not exists learner_reenrolments_school_status_idx
  on public.learner_reenrolments(school_id, status, created_at desc);
create index if not exists learner_reenrolments_learner_idx
  on public.learner_reenrolments(learner_id, created_at desc);

create or replace function public.create_school_reenrolment_campaign(
  p_school_id bigint,
  p_school_year integer,
  p_source_form_id uuid,
  p_registration_fee_type_id bigint,
  p_registration_fee_amount numeric,
  p_response_deadline date,
  p_created_by uuid
)
returns table(campaign_id uuid, learner_count integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_school_name text;
  v_school_code text;
  v_learner_count integer;
  v_last_number integer;
  v_first_number integer;
  v_campaign_id uuid;
begin
  select school_name into v_school_name from public.schools where id = p_school_id;
  if v_school_name is null then raise exception 'School not found'; end if;

  select count(*)::integer into v_learner_count from public.learners where school_id = p_school_id;
  insert into public.school_reenrolment_campaigns (
    school_id, school_year, source_form_id, registration_fee_type_id,
    registration_fee_amount, response_deadline, created_by
  ) values (
    p_school_id, p_school_year, p_source_form_id, p_registration_fee_type_id,
    greatest(coalesce(p_registration_fee_amount, 0), 0), p_response_deadline, p_created_by
  ) returning id into v_campaign_id;

  if v_learner_count = 0 then
    return query select v_campaign_id, 0;
    return;
  end if;

  select coalesce(nullif(string_agg(left(word, 1), ''), ''), 'SCH') into v_school_code
  from regexp_split_to_table(trim(v_school_name), '[[:space:]]+') as word;
  v_school_code := upper(left(regexp_replace(v_school_code, '[^A-Z]', '', 'g'), 5));
  if v_school_code = '' then v_school_code := 'SCH'; end if;

  insert into public.school_reenrolment_counters (school_id, school_year, last_number)
  values (p_school_id, p_school_year, v_learner_count)
  on conflict (school_id, school_year)
  do update set last_number = public.school_reenrolment_counters.last_number + excluded.last_number
  returning last_number into v_last_number;
  v_first_number := v_last_number - v_learner_count + 1;

  insert into public.learner_reenrolments (
    campaign_id, school_id, learner_id, reenrolment_reference,
    registration_fee_type_id, registration_fee_amount, registration_payment_status, created_by
  )
  select
    v_campaign_id,
    p_school_id,
    learner.id,
    v_school_code || '-RE-' || p_school_year::text || '-' || lpad((v_first_number + row_number() over (order by lower(coalesce(learner.name, '')), learner.id) - 1)::text, 4, '0'),
    p_registration_fee_type_id,
    greatest(coalesce(p_registration_fee_amount, 0), 0),
    case when coalesce(p_registration_fee_amount, 0) > 0 then 'pending' else 'not_required' end,
    p_created_by
  from public.learners as learner
  where learner.school_id = p_school_id;

  return query select v_campaign_id, v_learner_count;
end;
$$;

alter table public.school_reenrolment_campaigns enable row level security;
alter table public.school_reenrolment_counters enable row level security;
alter table public.learner_reenrolments enable row level security;

-- Access is kept behind authorised application API routes using the service role.
