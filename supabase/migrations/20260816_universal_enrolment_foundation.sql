-- Universal enrolment foundation.
-- Existing enquiries, learner documents, classroom requirements and learners.classroom_id
-- remain in use. These tables provide the school-level configuration and historical
-- enrolment/placement layer needed to evolve them safely.

create table if not exists public.school_enrolment_configurations (
  school_id bigint primary key references public.schools(id) on delete cascade,
  form_title text not null default 'Enrolment Form',
  introduction text,
  is_open boolean not null default true,
  second_guardian_mode text not null default 'optional' check (second_guardian_mode in ('hidden', 'optional', 'required')),
  emergency_contact_mode text not null default 'required' check (emergency_contact_mode in ('hidden', 'optional', 'required')),
  previous_school_enabled boolean not null default true,
  additional_declaration text,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.school_enrolment_configurations
  add column if not exists custom_fields jsonb not null default '[]'::jsonb;

insert into public.school_enrolment_configurations (school_id, form_title, introduction)
select school.id, coalesce(form.form_name, 'Enrolment Form'), form.instructions
from public.schools school
left join public.school_enrolment_forms form on form.school_id = school.id and form.form_type = 'general'
on conflict (school_id) do nothing;

update public.school_enrolment_configurations configuration
set custom_fields = form.custom_fields
from public.school_enrolment_forms form
where form.school_id = configuration.school_id
  and form.form_type = 'general'
  and jsonb_array_length(configuration.custom_fields) = 0
  and coalesce(jsonb_array_length(form.custom_fields), 0) > 0;

create table if not exists public.school_enrolment_document_requirements (
  id uuid primary key default gen_random_uuid(),
  school_id bigint not null references public.schools(id) on delete cascade,
  title text not null,
  instructions text,
  is_required boolean not null default false,
  is_active boolean not null default true,
  display_order integer not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.school_enrolment_document_requirements (school_id, title, is_required, is_active, display_order)
select form.school_id, document.title, true, true, document.ordinality::integer
from public.school_enrolment_forms form
cross join lateral jsonb_array_elements_text(coalesce(form.required_documents, '[]'::jsonb)) with ordinality as document(title, ordinality)
where form.form_type = 'general'
on conflict do nothing;

create table if not exists public.school_enrolment_requirement_templates (
  id uuid primary key default gen_random_uuid(),
  school_id bigint not null references public.schools(id) on delete cascade,
  category text not null check (category in ('stationery', 'hygiene')),
  item_name text not null,
  quantity text,
  instructions text,
  is_required boolean not null default false,
  is_active boolean not null default true,
  display_order integer not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, category, item_name)
);

insert into public.school_enrolment_requirement_templates (school_id, category, item_name, is_required, is_active, display_order)
select form.school_id, 'stationery', item.item_name, false, true, item.ordinality::integer
from public.school_enrolment_forms form
cross join lateral jsonb_array_elements_text(coalesce(form.stationery_list, '[]'::jsonb)) with ordinality as item(item_name, ordinality)
where form.form_type = 'general'
on conflict (school_id, category, item_name) do nothing;

create table if not exists public.school_enrolment_consents (
  id uuid primary key default gen_random_uuid(),
  school_id bigint not null references public.schools(id) on delete cascade,
  title text not null,
  wording text not null,
  is_required boolean not null default true,
  is_active boolean not null default true,
  display_order integer not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.school_enrolment_terms_sections (
  id uuid primary key default gen_random_uuid(),
  school_id bigint not null references public.schools(id) on delete cascade,
  title text not null,
  content text not null,
  is_active boolean not null default true,
  display_order integer not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.school_enrolment_enquiries
  add column if not exists academic_year integer check (academic_year between 2020 and 2100),
  add column if not exists enrolment_source text not null default 'digital_parent' check (enrolment_source in ('digital_parent', 'paper_manual_capture', 'printed_blank_form', 're_enrolment', 'existing_manual_learner')),
  add column if not exists configuration_snapshot jsonb not null default '{}'::jsonb,
  add column if not exists printed_at timestamptz,
  add column if not exists printed_by uuid references auth.users(id) on delete set null,
  add column if not exists paper_received_at timestamptz,
  add column if not exists paper_captured_by uuid references auth.users(id) on delete set null,
  add column if not exists learner_id uuid references public.learners(id) on delete set null;

update public.school_enrolment_enquiries
set academic_year = extract(year from coalesce(created_at, now()))::integer
where academic_year is null;

alter table public.school_enrolment_enquiries
  alter column academic_year set not null;

create table if not exists public.learner_placements (
  id uuid primary key default gen_random_uuid(),
  learner_id uuid not null references public.learners(id) on delete cascade,
  school_id bigint not null references public.schools(id) on delete cascade,
  academic_year integer not null check (academic_year between 2020 and 2100),
  classroom_id bigint references public.classrooms(id) on delete set null,
  placement_status text not null default 'future' check (placement_status in ('pending', 'future', 'current', 'completed')),
  start_date date,
  end_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (learner_id, academic_year)
);

create index if not exists school_enrolment_document_requirements_school_idx on public.school_enrolment_document_requirements (school_id, is_active, display_order);
create index if not exists school_enrolment_requirement_templates_school_idx on public.school_enrolment_requirement_templates (school_id, is_active, display_order);
create index if not exists school_enrolment_consents_school_idx on public.school_enrolment_consents (school_id, is_active, display_order);
create index if not exists school_enrolment_terms_sections_school_idx on public.school_enrolment_terms_sections (school_id, is_active, display_order);
create index if not exists school_enrolment_enquiries_learner_year_idx on public.school_enrolment_enquiries (learner_id, academic_year);
create index if not exists learner_placements_school_year_idx on public.learner_placements (school_id, academic_year, placement_status);

create or replace function public.next_school_enrolment_reference_for_year(p_school_id bigint, p_academic_year integer)
returns text language plpgsql security definer set search_path = public as $$
declare v_name text; v_code text; v_number integer;
begin
  select school_name into v_name from public.schools where id = p_school_id;
  if v_name is null then raise exception 'School not found'; end if;
  select coalesce(nullif(string_agg(left(word, 1), ''), ''), 'SCH') into v_code from regexp_split_to_table(trim(v_name), '[[:space:]]+') word;
  v_code := upper(left(regexp_replace(v_code, '[^A-Z]', '', 'g'), 5)); if v_code = '' then v_code := 'SCH'; end if;
  insert into public.school_enrolment_counters (school_id, enrolment_year, last_number) values (p_school_id, p_academic_year, 1)
  on conflict (school_id, enrolment_year) do update set last_number = public.school_enrolment_counters.last_number + 1 returning last_number into v_number;
  return v_code || '-' || p_academic_year::text || '-' || lpad(v_number::text, 4, '0');
end;
$$;

alter table public.school_enrolment_configurations enable row level security;
alter table public.school_enrolment_document_requirements enable row level security;
alter table public.school_enrolment_requirement_templates enable row level security;
alter table public.school_enrolment_consents enable row level security;
alter table public.school_enrolment_terms_sections enable row level security;
alter table public.learner_placements enable row level security;

comment on table public.learner_placements is
  'Historical and future-year source of truth. learners.classroom_id remains the current-placement compatibility field.';
