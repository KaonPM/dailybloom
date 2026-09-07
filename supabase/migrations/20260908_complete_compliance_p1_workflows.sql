-- Complete the P1 Compliance & Registration workflows without changing
-- existing records, storage configuration, or authorization boundaries.

alter table public.school_compliance_requirements
  add column if not exists verification_status text not null default 'Unverified';

create index if not exists compliance_requirement_evidence_requirement_idx
  on public.compliance_requirement_evidence (school_id, school_requirement_id);
create index if not exists compliance_requirement_evidence_document_idx
  on public.compliance_requirement_evidence (school_id, document_id);
create index if not exists compliance_findings_inspection_idx
  on public.compliance_inspection_findings (school_id, inspection_id, status);
create index if not exists compliance_actions_source_idx
  on public.compliance_corrective_actions (school_id, source_type, source_id);
