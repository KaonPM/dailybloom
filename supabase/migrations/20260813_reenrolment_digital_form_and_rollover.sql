-- Annual digital re-enrolment snapshots and controlled next-year classroom rollover.
-- Parent acknowledgements never mark documents or learner requirements as received.

alter table public.school_reenrolment_campaigns
  add column if not exists form_snapshot jsonb not null default '{}'::jsonb,
  add column if not exists rollover_applied_at timestamptz;

alter table public.learner_reenrolments
  add column if not exists renewal_snapshot jsonb not null default '{}'::jsonb,
  add column if not exists current_classroom_id bigint references public.classrooms(id) on delete set null,
  add column if not exists next_classroom_id bigint references public.classrooms(id) on delete set null,
  add column if not exists classroom_applied_at timestamptz;

create index if not exists learner_reenrolments_rollover_idx
  on public.learner_reenrolments(campaign_id, status, classroom_applied_at)
  where next_classroom_id is not null;

comment on column public.learner_reenrolments.renewal_snapshot is
  'Year-specific copy of learner details and outstanding documents/requirements shown to the parent.';
comment on column public.learner_reenrolments.next_classroom_id is
  'Planned classroom selected during approval; applied only by the controlled new-year rollover.';
