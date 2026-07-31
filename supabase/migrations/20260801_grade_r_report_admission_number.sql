alter table public.learners
  add column if not exists admission_number text;

comment on column public.learners.admission_number is
  'Optional school admission number, shown on Grade R learner reports when available.';
