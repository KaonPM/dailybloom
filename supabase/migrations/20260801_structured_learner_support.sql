alter table public.learner_support_updates
  add column if not exists support_identified text;

comment on column public.learner_support_updates.support_identified is
  'Practitioner-observed support need selected in relation to the originating classroom activity. This is descriptive and not a clinical diagnosis.';
