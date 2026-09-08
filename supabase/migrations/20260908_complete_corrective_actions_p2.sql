-- Complete the existing school-scoped corrective-action foundation additively.
-- Existing actions, documents and RLS behaviour are preserved.

alter table public.compliance_corrective_actions
  add column if not exists started_at timestamptz,
  add column if not exists submitted_for_verification_at timestamptz,
  add column if not exists closed_at timestamptz,
  add column if not exists reopened_at timestamptz,
  add column if not exists reopened_by uuid,
  add column if not exists resolution_notes text,
  add column if not exists verification_notes text,
  add column if not exists reopening_reason text,
  add column if not exists updated_by uuid;

create or replace function public.ensure_corrective_action_integrity()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.source_type = 'inspection_finding' and not exists (
    select 1 from public.compliance_inspection_findings finding
    where finding.id = new.source_id and finding.school_id = new.school_id
  ) then
    raise exception 'Inspection-finding sources must belong to the action school';
  end if;
  if new.source_type = 'requirement' and not exists (
    select 1 from public.school_compliance_requirements requirement
    where requirement.id = new.source_id and requirement.school_id = new.school_id
  ) then
    raise exception 'Requirement sources must belong to the action school';
  end if;
  if new.responsible_user_id is not null and not exists (
    select 1 from public.profiles profile where profile.id = new.responsible_user_id and profile.school_id = new.school_id
    union all
    select 1 from public.school_memberships membership where membership.user_id = new.responsible_user_id and membership.school_id = new.school_id
  ) then
    raise exception 'Responsible person must belong to the action school';
  end if;
  return new;
end;
$$;

drop trigger if exists compliance_corrective_actions_integrity on public.compliance_corrective_actions;
create trigger compliance_corrective_actions_integrity
before insert or update on public.compliance_corrective_actions
for each row execute function public.ensure_corrective_action_integrity();

create table if not exists public.compliance_corrective_action_evidence (
  id uuid primary key default gen_random_uuid(),
  school_id bigint not null references public.schools(id) on delete restrict,
  corrective_action_id uuid not null references public.compliance_corrective_actions(id) on delete cascade,
  document_id uuid not null references public.dbe_compliance_documents(id) on delete restrict,
  linked_at timestamptz not null default now(),
  linked_by uuid,
  unique (corrective_action_id, document_id)
);

create index if not exists compliance_actions_active_due_priority_idx
  on public.compliance_corrective_actions (school_id, status, due_date, priority);
create index if not exists compliance_actions_responsible_idx
  on public.compliance_corrective_actions (school_id, responsible_user_id, status);
create index if not exists compliance_action_evidence_action_idx
  on public.compliance_corrective_action_evidence (school_id, corrective_action_id);
create index if not exists compliance_action_evidence_document_idx
  on public.compliance_corrective_action_evidence (school_id, document_id);

create or replace function public.ensure_corrective_action_evidence_school_match()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.compliance_corrective_actions action
    where action.id = new.corrective_action_id and action.school_id = new.school_id
  ) then
    raise exception 'Corrective action must belong to the same school as its evidence link';
  end if;
  if not exists (
    select 1 from public.dbe_compliance_documents document
    where document.id = new.document_id and document.school_id = new.school_id
  ) then
    raise exception 'Evidence document must belong to the same school as its corrective action';
  end if;
  return new;
end;
$$;

drop trigger if exists compliance_action_evidence_school_match on public.compliance_corrective_action_evidence;
create trigger compliance_action_evidence_school_match
before insert or update on public.compliance_corrective_action_evidence
for each row execute function public.ensure_corrective_action_evidence_school_match();

alter table public.compliance_corrective_action_evidence enable row level security;
drop policy if exists "DBE managed school access" on public.compliance_corrective_action_evidence;
create policy "DBE managed school access"
  on public.compliance_corrective_action_evidence
  for all to authenticated
  using (public.current_user_can_manage_dbe_school(school_id))
  with check (public.current_user_can_manage_dbe_school(school_id));
