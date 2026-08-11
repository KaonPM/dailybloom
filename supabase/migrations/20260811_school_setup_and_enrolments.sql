-- School Setup and pre-enrolment pipeline.
-- The existing school_fee_types Registration Fee remains the only fee source.
-- This migration does not change learner billing, existing learners, or school fees.

create table if not exists public.school_setup_settings (
  school_id bigint primary key references public.schools(id) on delete cascade,
  bank_account_name text,
  bank_name text,
  bank_account_number text,
  bank_branch_code text,
  bank_account_type text,
  payment_reminder_day smallint not null default 1 check (payment_reminder_day between 1 and 28),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.school_enrolment_forms (
  id uuid primary key default gen_random_uuid(),
  school_id bigint not null references public.schools(id) on delete cascade,
  form_type text not null check (form_type in ('general', 'babies', 'grade_r')),
  form_name text not null,
  instructions text,
  source_document_path text,
  source_document_name text,
  source_document_content_type text,
  source_document_size bigint,
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, form_type)
);

create table if not exists public.school_enrolment_counters (
  school_id bigint not null references public.schools(id) on delete cascade,
  enrolment_year integer not null,
  last_number integer not null default 0 check (last_number >= 0),
  primary key (school_id, enrolment_year)
);

create or replace function public.next_school_enrolment_reference(p_school_id bigint)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  school_name text;
  school_code text;
  enrolment_year integer := extract(year from now())::integer;
  next_number integer;
begin
  select school.school_name into school_name
  from public.schools as school
  where school.id = p_school_id;
  if school_name is null then
    raise exception 'School not found';
  end if;

  select coalesce(nullif(string_agg(left(word, 1), ''), ''), 'SCH')
  into school_code
  from regexp_split_to_table(trim(school_name), '[[:space:]]+') as word;
  school_code := upper(left(regexp_replace(school_code, '[^A-Z]', '', 'g'), 5));
  if school_code = '' then school_code := 'SCH'; end if;

  insert into public.school_enrolment_counters (school_id, enrolment_year, last_number)
  values (p_school_id, enrolment_year, 1)
  on conflict (school_id, enrolment_year)
  do update set last_number = public.school_enrolment_counters.last_number + 1
  returning last_number into next_number;

  return school_code || '-' || enrolment_year::text || '-' || lpad(next_number::text, 4, '0');
end;
$$;

create table if not exists public.school_enrolment_enquiries (
  id uuid primary key default gen_random_uuid(),
  school_id bigint not null references public.schools(id) on delete cascade,
  form_id uuid references public.school_enrolment_forms(id) on delete set null,
  enquiry_reference text not null unique,
  parent_name text not null,
  parent_phone text not null,
  registration_fee_type_id bigint references public.school_fee_types(id) on delete restrict,
  registration_fee_amount numeric(12,2) not null default 0 check (registration_fee_amount >= 0),
  registration_payment_status text not null default 'pending'
    check (registration_payment_status in ('pending', 'verified', 'waived')),
  registration_payment_reference text,
  registration_payment_verified_at timestamptz,
  registration_payment_verified_by uuid references auth.users(id) on delete set null,
  status text not null default 'payment_pending'
    check (status in ('payment_pending', 'form_issued', 'submitted', 'approved', 'declined', 'withdrawn')),
  form_token_hash text unique,
  form_token_expires_at timestamptz,
  submitted_data jsonb not null default '{}'::jsonb,
  submitted_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  decline_reason text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists school_enrolment_enquiries_school_status_idx
  on public.school_enrolment_enquiries(school_id, status, created_at desc);
create index if not exists school_enrolment_enquiries_school_phone_idx
  on public.school_enrolment_enquiries(school_id, parent_phone);
create index if not exists school_enrolment_enquiries_token_idx
  on public.school_enrolment_enquiries(form_token_hash);

alter table public.school_setup_settings enable row level security;
alter table public.school_enrolment_forms enable row level security;
alter table public.school_enrolment_counters enable row level security;
alter table public.school_enrolment_enquiries enable row level security;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'school-enrolment-forms',
  'school-enrolment-forms',
  false,
  10485760,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- Access is intentionally through authorised API routes using the service role.
