-- Ensure every saved universal configuration has the active general-form row
-- required by the Enrolments workflow. This leaves learner and enquiry data
-- untouched and preserves existing legacy requirement lists.
insert into public.school_enrolment_forms (
  school_id,
  form_type,
  form_name,
  instructions,
  custom_fields,
  required_documents,
  stationery_list,
  is_active,
  created_by,
  updated_by,
  updated_at
)
select
  configuration.school_id,
  'general',
  configuration.form_title,
  configuration.introduction,
  configuration.custom_fields,
  '[]'::jsonb,
  '[]'::jsonb,
  configuration.is_open,
  configuration.created_by,
  configuration.updated_by,
  now()
from public.school_enrolment_configurations configuration
on conflict (school_id, form_type) do update
set
  form_name = excluded.form_name,
  instructions = excluded.instructions,
  custom_fields = excluded.custom_fields,
  is_active = excluded.is_active,
  updated_by = excluded.updated_by,
  updated_at = excluded.updated_at;
