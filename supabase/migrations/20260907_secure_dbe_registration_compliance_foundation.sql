-- Security hardening for the reconciled DBE registration/compliance foundation.
--
-- Pre-migration production checks on 2026-09-07 found no duplicate or orphaned
-- school references and no document-path mismatches. One unlinked storage
-- object remains intentionally untouched for manual review:
-- 15/c3794dd0-c5a0-439c-901f-371928fc6000-Building-Plan.pdf
--
-- This migration neither deletes nor updates existing business data.

create or replace function public.current_user_can_manage_dbe_school(
  target_school_id bigint
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles profile
    where profile.id = auth.uid()
      and coalesce(profile.is_active, true)
      and (
        profile.role = 'master'
        or public.current_platform_has_permission('dbe.manage')
        or exists (
          select 1
          from public.school_memberships membership
          where membership.user_id = auth.uid()
            and membership.school_id = target_school_id
            and membership.status = 'active'
            and (
              membership.role in ('owner', 'principal')
              or (
                membership.role = 'admin'
                and (
                  coalesce(array_length(membership.permissions, 1), 0) = 0
                  or 'dbe.manage' = any(membership.permissions)
                )
              )
            )
        )
      )
  );
$$;

revoke all on function public.current_user_can_manage_dbe_school(bigint)
  from public;
grant execute on function public.current_user_can_manage_dbe_school(bigint)
  to authenticated;

-- The checks above confirmed that these restrictive foreign keys and the
-- one-current-registration constraint are safe for the production data.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.dbe_registration'::regclass
      and conname = 'dbe_registration_school_id_fkey'
  ) then
    alter table public.dbe_registration
      add constraint dbe_registration_school_id_fkey
      foreign key (school_id) references public.schools(id) on delete restrict;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.dbe_compliance_documents'::regclass
      and conname = 'dbe_compliance_documents_school_id_fkey'
  ) then
    alter table public.dbe_compliance_documents
      add constraint dbe_compliance_documents_school_id_fkey
      foreign key (school_id) references public.schools(id) on delete restrict;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.dbe_registration'::regclass
      and conname = 'dbe_registration_school_id_key'
  ) then
    alter table public.dbe_registration
      add constraint dbe_registration_school_id_key unique (school_id);
  end if;
end;
$$;

create index if not exists dbe_compliance_documents_school_id_idx
  on public.dbe_compliance_documents (school_id);
create index if not exists dbe_compliance_documents_uploaded_at_idx
  on public.dbe_compliance_documents (uploaded_at desc);

-- Replace the deployed public/true policies. The application now uses a
-- server-authorized route for registration writes; these policies additionally
-- protect any direct authenticated database access.
drop policy if exists "view dbe registration" on public.dbe_registration;
drop policy if exists "insert dbe registration" on public.dbe_registration;
drop policy if exists "update dbe registration" on public.dbe_registration;
drop policy if exists "delete dbe registration" on public.dbe_registration;
drop policy if exists "DBE registration managed school read" on public.dbe_registration;
drop policy if exists "DBE registration managed school insert" on public.dbe_registration;
drop policy if exists "DBE registration managed school update" on public.dbe_registration;

create policy "DBE registration managed school read"
  on public.dbe_registration
  for select
  to authenticated
  using (public.current_user_can_manage_dbe_school(school_id));

create policy "DBE registration managed school insert"
  on public.dbe_registration
  for insert
  to authenticated
  with check (public.current_user_can_manage_dbe_school(school_id));

create policy "DBE registration managed school update"
  on public.dbe_registration
  for update
  to authenticated
  using (public.current_user_can_manage_dbe_school(school_id))
  with check (public.current_user_can_manage_dbe_school(school_id));

drop policy if exists "view dbe documents" on public.dbe_compliance_documents;
drop policy if exists "insert dbe documents" on public.dbe_compliance_documents;
drop policy if exists "update dbe documents" on public.dbe_compliance_documents;
drop policy if exists "delete dbe documents" on public.dbe_compliance_documents;
drop policy if exists "DBE compliance documents managed school access" on public.dbe_compliance_documents;

create policy "DBE compliance documents managed school access"
  on public.dbe_compliance_documents
  for all
  to authenticated
  using (public.current_user_can_manage_dbe_school(school_id))
  with check (public.current_user_can_manage_dbe_school(school_id));

-- Private evidence is served only by server-issued, short-lived signed URLs.
-- Signed uploads and service-role deletes remain available to the existing API.
update storage.buckets
set
  public = false,
  file_size_limit = 15728640,
  allowed_mime_types = array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/jpeg',
    'image/png'
  ]
where id = 'dbe-compliance-documents';

drop policy if exists "Allow authenticated DBE document uploads" on storage.objects;
drop policy if exists "Allow authenticated DBE document viewing" on storage.objects;
drop policy if exists "DBE compliance documents scoped access" on storage.objects;

-- Deliberately no client storage.objects policies: uploads use a server-issued
-- signed-upload token and reads use a server-issued signed URL. This prevents
-- browser clients from listing, reading, changing, or deleting raw objects.
