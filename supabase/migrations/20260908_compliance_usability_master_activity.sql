-- Add optional guidance and categorisation only. Existing compliance records remain valid.
alter table public.compliance_requirements
  add column if not exists plain_language_description text,
  add column if not exists why_it_matters text,
  add column if not exists preparation_guidance text,
  add column if not exists authority_review_guidance text,
  add column if not exists owner_guidance text,
  add column if not exists applicability_guidance text,
  add column if not exists ready_definition text,
  add column if not exists next_action_guidance text;

-- Traceability fields are nullable or neutral by default: do not infer government sources.
alter table public.compliance_requirements
  add column if not exists authority_type text not null default 'other',
  add column if not exists authority_name text,
  add column if not exists source_title text,
  add column if not exists source_url text,
  add column if not exists source_version text,
  add column if not exists source_effective_date date,
  add column if not exists source_last_verified_at timestamptz,
  add column if not exists applicability_scope text not null default 'needs_review',
  add column if not exists country text,
  add column if not exists province text,
  add column if not exists municipality text,
  add column if not exists programme_type text,
  add column if not exists age_group text,
  add column if not exists school_category text,
  add column if not exists conditional_rule text,
  add column if not exists applicability_notes text,
  add column if not exists requirement_category text,
  add column if not exists requirement_status text not null default 'unclassified',
  add column if not exists minimum_evidence_count integer,
  add column if not exists accepted_evidence_types text[],
  add column if not exists evidence_examples text,
  add column if not exists verification_guidance text,
  add column if not exists issuer_or_authority text,
  add column if not exists document_number_expected boolean not null default false,
  add column if not exists expires boolean not null default false,
  add column if not exists expiry_rule text,
  add column if not exists renewal_frequency_months integer,
  add column if not exists renewal_guidance text,
  add column if not exists warning_days_before_expiry integer,
  add column if not exists plain_language_title text,
  add column if not exists what_this_is text,
  add column if not exists what_to_prepare text,
  add column if not exists what_authority_may_ask_to_see text,
  add column if not exists school_action text,
  add column if not exists guidance_notes text,
  add column if not exists created_by uuid,
  add column if not exists updated_by uuid,
  add column if not exists archived_at timestamptz;

-- Existing catalogue rows are deliberately not relabelled as official requirements.
update public.compliance_requirements
set authority_type = coalesce(nullif(authority_type, ''), 'other'),
    applicability_scope = coalesce(nullif(applicability_scope, ''), 'needs_review'),
    requirement_status = coalesce(nullif(requirement_status, ''), 'unclassified')
where authority_type is null or applicability_scope is null or requirement_status is null;

-- The original DailyBloom preparation prompts are not treated as external
-- regulatory sources. Label them honestly until a verified authority source is
-- supplied through the Master catalogue.
update public.compliance_requirements
set authority_type = 'dailybloom_guidance',
    authority_name = 'DailyBloom',
    source_title = coalesce(nullif(source_title, ''), 'DailyBloom registration-readiness guidance'),
    applicability_scope = 'guidance_only',
    requirement_status = 'dailybloom_guidance',
    applicability_notes = coalesce(nullif(applicability_notes, ''), 'Guidance only. Confirm official requirements with the relevant authority.')
where source_reference = 'DailyBloom verified preparation scope';

create index if not exists compliance_requirements_traceability_idx
  on public.compliance_requirements (active, requirement_category, authority_type, applicability_scope);

alter table public.compliance_corrective_actions
  add column if not exists category text;

create index if not exists compliance_actions_school_category_idx
  on public.compliance_corrective_actions (school_id, category)
  where category is not null;

create index if not exists security_audit_compliance_recent_idx
  on public.security_audit_log (created_at desc)
  where action like 'compliance.%' or action like 'dbe.%';
