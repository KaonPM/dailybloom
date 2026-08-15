-- Principal-managed optional questions for each secure parent enrolment form.
alter table public.school_enrolment_forms
  add column if not exists custom_fields jsonb not null default '[]'::jsonb;

alter table public.school_enrolment_forms
  add column if not exists required_documents jsonb not null default '[]'::jsonb,
  add column if not exists stationery_list jsonb not null default '[]'::jsonb;
