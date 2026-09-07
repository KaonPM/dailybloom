-- Reconciliation baseline for DBE registration and compliance documents.
--
-- Captured from the deployed DailyBloom production database on 2026-09-07.
-- This migration is intentionally additive and idempotent: when the deployed
-- objects already exist, it does not drop, recreate, backfill, or alter data.
--
-- SECURITY NOTE:
-- The policies below intentionally mirror the deployed foundation exactly.
-- They are overly broad and must be replaced in a separate, reviewed security
-- migration. Do not combine that remediation with this history-reconciliation
-- migration, because this file's purpose is to accurately record the existing
-- deployed baseline without changing its behaviour.

create table if not exists public.dbe_registration (
  id uuid primary key default gen_random_uuid(),
  school_id bigint not null,
  school_name text,
  registration_number text,
  registration_status text default 'Registration In Progress'::text,
  registration_date date,
  principal_name text,
  contact_number text,
  email_address text,
  physical_address text,
  health_certificate_status text default 'Valid'::text,
  fire_certificate_status text default 'Valid'::text,
  municipal_approval_status text default 'Valid'::text,
  police_clearance_status text default 'Valid'::text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.dbe_compliance_documents (
  id uuid primary key default gen_random_uuid(),
  school_id bigint not null,
  document_name text not null,
  file_path text not null,
  file_name text,
  uploaded_at timestamptz default now()
);

alter table public.dbe_registration enable row level security;
alter table public.dbe_compliance_documents enable row level security;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'dbe-compliance-documents',
  'dbe-compliance-documents',
  true,
  null,
  null
)
on conflict (id) do nothing;

-- Deployed table policies retained exactly for migration-history parity.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'dbe_registration'
      and policyname = 'view dbe registration'
  ) then
    create policy "view dbe registration"
      on public.dbe_registration for select to public using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'dbe_registration'
      and policyname = 'insert dbe registration'
  ) then
    create policy "insert dbe registration"
      on public.dbe_registration for insert to public with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'dbe_registration'
      and policyname = 'update dbe registration'
  ) then
    create policy "update dbe registration"
      on public.dbe_registration for update to public using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'dbe_compliance_documents'
      and policyname = 'view dbe documents'
  ) then
    create policy "view dbe documents"
      on public.dbe_compliance_documents for select to public using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'dbe_compliance_documents'
      and policyname = 'insert dbe documents'
  ) then
    create policy "insert dbe documents"
      on public.dbe_compliance_documents for insert to public with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'dbe_compliance_documents'
      and policyname = 'update dbe documents'
  ) then
    create policy "update dbe documents"
      on public.dbe_compliance_documents for update to public using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'dbe_compliance_documents'
      and policyname = 'delete dbe documents'
  ) then
    create policy "delete dbe documents"
      on public.dbe_compliance_documents for delete to public using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Allow authenticated DBE document uploads'
  ) then
    create policy "Allow authenticated DBE document uploads"
      on storage.objects for insert to authenticated
      with check (bucket_id = 'dbe-compliance-documents'::text);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Allow authenticated DBE document viewing'
  ) then
    create policy "Allow authenticated DBE document viewing"
      on storage.objects for select to authenticated
      using (bucket_id = 'dbe-compliance-documents'::text);
  end if;
end;
$$;

comment on table public.dbe_registration is
  'Reconciled deployed baseline. Security hardening must be applied separately.';
comment on table public.dbe_compliance_documents is
  'Reconciled deployed baseline. Security hardening must be applied separately.';
