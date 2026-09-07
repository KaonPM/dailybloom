-- DailyBloom Compliance & Registration operating foundation.
-- Additive only: existing DBE registration and evidence remain in place.

alter table public.dbe_registration
  add column if not exists official_status text,
  add column if not exists status_source text,
  add column if not exists last_verified_at timestamptz,
  add column if not exists verified_by uuid,
  add column if not exists registration_notes text;

alter table public.dbe_compliance_documents
  add column if not exists document_type text,
  add column if not exists issue_date date,
  add column if not exists expiry_date date,
  add column if not exists issuing_authority text,
  add column if not exists document_reference text,
  add column if not exists verification_status text not null default 'Unverified',
  add column if not exists verified_at timestamptz,
  add column if not exists verified_by uuid,
  add column if not exists notes text;

create table if not exists public.compliance_requirements (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  title text not null,
  description text,
  requirement_group text not null default 'General',
  registration_stage text not null default 'GENERAL',
  requirement_classification text not null default 'Ongoing compliance',
  source_type text not null default 'School / Internal',
  source_reference text,
  required boolean not null default true,
  evidence_required boolean not null default false,
  expiry_tracking_enabled boolean not null default false,
  applies_to_staff boolean not null default false,
  applies_to_premises boolean not null default false,
  effective_from date,
  effective_to date,
  version integer not null default 1,
  display_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (code, version)
);

create table if not exists public.school_compliance_requirements (
  id uuid primary key default gen_random_uuid(),
  school_id bigint not null references public.schools(id) on delete restrict,
  requirement_id uuid not null references public.compliance_requirements(id) on delete restrict,
  status text not null default 'Not Started',
  notes text,
  due_date date,
  expires_at date,
  verified_at timestamptz,
  verified_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, requirement_id)
);

create table if not exists public.compliance_requirement_evidence (
  id uuid primary key default gen_random_uuid(),
  school_id bigint not null references public.schools(id) on delete restrict,
  school_requirement_id uuid not null references public.school_compliance_requirements(id) on delete cascade,
  document_id uuid not null references public.dbe_compliance_documents(id) on delete cascade,
  linked_at timestamptz not null default now(),
  linked_by uuid,
  unique (school_requirement_id, document_id)
);

create table if not exists public.staff_compliance_items (
  id uuid primary key default gen_random_uuid(),
  school_id bigint not null references public.schools(id) on delete restrict,
  staff_user_id uuid not null,
  requirement_id uuid references public.compliance_requirements(id) on delete set null,
  title text not null,
  status text not null default 'Not Started',
  issue_date date,
  expiry_date date,
  verification_status text not null default 'Unverified',
  verified_at timestamptz,
  verified_by uuid,
  document_id uuid references public.dbe_compliance_documents(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.compliance_inspections (
  id uuid primary key default gen_random_uuid(),
  school_id bigint not null references public.schools(id) on delete restrict,
  inspection_type text not null,
  inspection_scope text not null default 'Internal',
  inspecting_authority text,
  scheduled_date date,
  inspection_date date,
  status text not null default 'Scheduled',
  outcome text,
  inspector_reference text,
  notes text,
  follow_up_date date,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.compliance_inspection_findings (
  id uuid primary key default gen_random_uuid(),
  school_id bigint not null references public.schools(id) on delete restrict,
  inspection_id uuid not null references public.compliance_inspections(id) on delete cascade,
  requirement_id uuid references public.compliance_requirements(id) on delete set null,
  category text,
  description text not null,
  priority text not null default 'Normal',
  status text not null default 'Open',
  evidence_document_id uuid references public.dbe_compliance_documents(id) on delete set null,
  corrective_action_required boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.compliance_corrective_actions (
  id uuid primary key default gen_random_uuid(),
  school_id bigint not null references public.schools(id) on delete restrict,
  title text not null,
  description text,
  source_type text,
  source_id uuid,
  responsible_user_id uuid,
  due_date date,
  priority text not null default 'Normal',
  status text not null default 'Open',
  completed_at timestamptz,
  verified_at timestamptz,
  verified_by uuid,
  notes text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.compliance_certificates (
  id uuid primary key default gen_random_uuid(),
  school_id bigint not null references public.schools(id) on delete restrict,
  certificate_type text not null,
  holder_name text,
  issue_date date,
  expiry_date date,
  issuing_authority text,
  certificate_reference text,
  document_id uuid references public.dbe_compliance_documents(id) on delete set null,
  verification_status text not null default 'Unverified',
  verified_at timestamptz,
  verified_by uuid,
  renewal_status text not null default 'Current',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists school_compliance_requirements_school_id_idx on public.school_compliance_requirements(school_id, status);
create index if not exists compliance_requirement_evidence_school_id_idx on public.compliance_requirement_evidence(school_id);
create index if not exists staff_compliance_items_school_id_idx on public.staff_compliance_items(school_id, staff_user_id);
create index if not exists compliance_inspections_school_id_idx on public.compliance_inspections(school_id, scheduled_date desc);
create index if not exists compliance_findings_school_id_idx on public.compliance_inspection_findings(school_id, status);
create index if not exists compliance_actions_school_id_idx on public.compliance_corrective_actions(school_id, status, due_date);
create index if not exists compliance_certificates_school_id_idx on public.compliance_certificates(school_id, expiry_date);
create index if not exists dbe_compliance_documents_expiry_idx on public.dbe_compliance_documents(school_id, expiry_date);

-- All school-owned compliance data uses the already-audited DBE school helper.
do $$
declare tbl text;
begin
  foreach tbl in array array[
    'school_compliance_requirements', 'compliance_requirement_evidence',
    'staff_compliance_items', 'compliance_inspections',
    'compliance_inspection_findings', 'compliance_corrective_actions',
    'compliance_certificates'
  ] loop
    execute format('alter table public.%I enable row level security', tbl);
    execute format('drop policy if exists "DBE managed school access" on public.%I', tbl);
    execute format('create policy "DBE managed school access" on public.%I for all to authenticated using (public.current_user_can_manage_dbe_school(school_id)) with check (public.current_user_can_manage_dbe_school(school_id))', tbl);
  end loop;
end $$;

alter table public.compliance_requirements enable row level security;
drop policy if exists "DBE requirement catalogue read" on public.compliance_requirements;
create policy "DBE requirement catalogue read" on public.compliance_requirements
  for select to authenticated using (auth.uid() is not null);

-- Conservative, source-labelled seed data. These are planning prompts, not official determinations.
insert into public.compliance_requirements
  (code, title, description, requirement_group, registration_stage, requirement_classification, source_type, source_reference, required, evidence_required, applies_to_staff, active, display_order)
values
  ('APPLY-OFFICIAL-PREPARATION', 'Official application preparation', 'Record and organise official application information before submission.', 'Registration', 'APPLY', 'Submit with application', 'DBE / Bana Pele', 'DailyBloom verified preparation scope', true, false, false, true, 10),
  ('APPLY-HEALTH-SAFETY', 'Health and safety self-assessment', 'Maintain a school self-assessment and supporting evidence where available.', 'Health & Safety', 'APPLY', 'Available at site inspection', 'School / Internal', 'Existing DailyBloom health compliance field', true, true, false, true, 20),
  ('APPLY-CONDITIONS-ACK', 'Agreement and conditions acknowledgement', 'Keep the school acknowledgement or supporting record where applicable.', 'Registration', 'APPLY', 'Submit with application', 'DBE / Bana Pele', 'DailyBloom verified preparation scope', true, true, false, true, 30),
  ('APPLY-STAFF-SUPPORT', 'Staff supporting information', 'Maintain staff identity and supporting information where applicable; DailyBloom does not perform official checks.', 'Staff Compliance', 'APPLY', 'Available at site inspection', 'DBE / Bana Pele', 'DailyBloom verified preparation scope', true, false, true, true, 40)
on conflict (code, version) do nothing;
