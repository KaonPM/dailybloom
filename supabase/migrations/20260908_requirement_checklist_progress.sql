-- Persist school progress for the detailed preparation checklist.
-- This is additive: no existing requirement status, evidence, or source data changes.
alter table public.school_compliance_requirements
  add column if not exists checklist_state jsonb not null default '{}'::jsonb;

alter table public.school_compliance_requirements
  drop constraint if exists school_compliance_requirements_checklist_state_object;
alter table public.school_compliance_requirements
  add constraint school_compliance_requirements_checklist_state_object
  check (jsonb_typeof(checklist_state) = 'object');
