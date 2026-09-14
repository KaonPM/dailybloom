-- Let existing private Documents & Evidence records be linked wherever they are
-- needed. These are references only: files are not copied or moved.

alter table public.dbe_registration
  add column if not exists official_status_document_id uuid references public.dbe_compliance_documents(id) on delete set null,
  add column if not exists health_certificate_document_id uuid references public.dbe_compliance_documents(id) on delete set null,
  add column if not exists fire_certificate_document_id uuid references public.dbe_compliance_documents(id) on delete set null,
  add column if not exists municipal_approval_document_id uuid references public.dbe_compliance_documents(id) on delete set null;

alter table public.compliance_inspections
  add column if not exists evidence_document_id uuid references public.dbe_compliance_documents(id) on delete set null;

create index if not exists dbe_registration_official_status_document_idx
  on public.dbe_registration (official_status_document_id)
  where official_status_document_id is not null;
create index if not exists dbe_registration_health_document_idx
  on public.dbe_registration (health_certificate_document_id)
  where health_certificate_document_id is not null;
create index if not exists dbe_registration_fire_document_idx
  on public.dbe_registration (fire_certificate_document_id)
  where fire_certificate_document_id is not null;
create index if not exists dbe_registration_municipal_document_idx
  on public.dbe_registration (municipal_approval_document_id)
  where municipal_approval_document_id is not null;
create index if not exists compliance_inspections_evidence_document_idx
  on public.compliance_inspections (evidence_document_id)
  where evidence_document_id is not null;
create index if not exists compliance_inspection_findings_evidence_document_idx
  on public.compliance_inspection_findings (evidence_document_id)
  where evidence_document_id is not null;

create or replace function public.ensure_compliance_evidence_school_match()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  linked_document_id uuid;
begin
  if tg_table_name = 'dbe_registration' then
    foreach linked_document_id in array array[
      new.official_status_document_id,
      new.health_certificate_document_id,
      new.fire_certificate_document_id,
      new.municipal_approval_document_id
    ]::uuid[] loop
      if linked_document_id is not null and not exists (
        select 1
        from public.dbe_compliance_documents document
        where document.id = linked_document_id
          and document.school_id = new.school_id
      ) then
        raise exception 'The selected evidence document does not belong to this school.';
      end if;
    end loop;
  else
    if tg_table_name = 'compliance_inspection_findings' and not exists (
      select 1
      from public.compliance_inspections inspection
      where inspection.id = new.inspection_id
        and inspection.school_id = new.school_id
    ) then
      raise exception 'The selected inspection does not belong to this school.';
    end if;

    linked_document_id := new.evidence_document_id;
    if linked_document_id is not null and not exists (
      select 1
      from public.dbe_compliance_documents document
      where document.id = linked_document_id
        and document.school_id = new.school_id
    ) then
      raise exception 'The selected evidence document does not belong to this school.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists dbe_registration_evidence_school_match on public.dbe_registration;
create trigger dbe_registration_evidence_school_match
before insert or update of
  school_id,
  official_status_document_id,
  health_certificate_document_id,
  fire_certificate_document_id,
  municipal_approval_document_id
on public.dbe_registration
for each row execute function public.ensure_compliance_evidence_school_match();

drop trigger if exists compliance_inspections_evidence_school_match on public.compliance_inspections;
create trigger compliance_inspections_evidence_school_match
before insert or update of school_id, evidence_document_id
on public.compliance_inspections
for each row execute function public.ensure_compliance_evidence_school_match();

drop trigger if exists compliance_inspection_findings_evidence_school_match on public.compliance_inspection_findings;
create trigger compliance_inspection_findings_evidence_school_match
before insert or update of school_id, inspection_id, evidence_document_id
on public.compliance_inspection_findings
for each row execute function public.ensure_compliance_evidence_school_match();

comment on function public.ensure_compliance_evidence_school_match() is
  'Prevents a compliance record from linking evidence owned by a different school.';
