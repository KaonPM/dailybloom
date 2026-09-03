-- School Setup controls which editable learner-requirement lists appear on
-- the universal enrolment form. Existing 0-2 and 2-6 lists keep their data;
-- separate Babies, Toddlers and Grade R lists can be configured alongside them.
alter table public.school_enrolment_configurations
  add column if not exists requirement_template_keys text[] not null default array['0_2', '2_6']::text[];

alter table public.school_enrolment_requirement_templates
  drop constraint if exists school_enrolment_requirement_templates_template_key_check;

alter table public.school_enrolment_requirement_templates
  add constraint school_enrolment_requirement_templates_template_key_check
  check (template_key in ('0_2', '2_6', 'babies', 'toddlers', 'grade_r'));
