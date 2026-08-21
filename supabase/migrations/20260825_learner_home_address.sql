-- Stores the residential address captured on universal enrolment and re-enrolment forms.
-- The application already reads and writes this field, so keep the schema aligned
-- without affecting existing learner records.
alter table public.learners
  add column if not exists home_address text;

comment on column public.learners.home_address is
  'Residential address supplied during enrolment or re-enrolment.';
