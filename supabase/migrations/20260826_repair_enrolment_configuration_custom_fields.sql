-- Repair deployments where the universal enrolment foundation was applied
-- without its optional parent-question column.
alter table public.school_enrolment_configurations
  add column if not exists custom_fields jsonb not null default '[]'::jsonb;
