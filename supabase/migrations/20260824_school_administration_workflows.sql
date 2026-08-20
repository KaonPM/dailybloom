-- School administration workflows: re-enrolment transitions, meetings and surveys.
alter table public.learner_reenrolments drop constraint if exists learner_reenrolments_status_check;
alter table public.learner_reenrolments add constraint learner_reenrolments_status_check
  check (status in ('awaiting_parent','submitted','approved','declined','withdrawn','no_response','school_leaver','not_returning'));

create table if not exists public.school_meetings (
  id uuid primary key default gen_random_uuid(), school_id bigint not null references public.schools(id) on delete cascade,
  title text not null, meeting_date timestamptz not null, audience text not null default 'whole_school', classroom_id bigint references public.classrooms(id) on delete set null,
  agenda_url text, agenda_published_at timestamptz, minutes_url text, minutes_published_at timestamptz,
  acknowledgement_required boolean not null default true, created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.school_meeting_acknowledgements (
  meeting_id uuid not null references public.school_meetings(id) on delete cascade, learner_id uuid not null references public.learners(id) on delete cascade,
  parent_phone text not null, acknowledged_at timestamptz not null default now(), primary key(meeting_id, learner_id, parent_phone)
);
create table if not exists public.school_surveys (
  id uuid primary key default gen_random_uuid(), school_id bigint not null references public.schools(id) on delete cascade,
  title text not null, description text, survey_type text not null check (survey_type in ('dailybloom','external')),
  external_url text, questions jsonb not null default '[]'::jsonb, audience text not null default 'whole_school', classroom_id bigint references public.classrooms(id) on delete set null,
  opens_at timestamptz, closes_at timestamptz, anonymous boolean not null default false, published_at timestamptz,
  created_by uuid references auth.users(id) on delete set null, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.school_survey_responses (
  id uuid primary key default gen_random_uuid(), survey_id uuid not null references public.school_surveys(id) on delete cascade,
  learner_id uuid references public.learners(id) on delete set null, parent_phone text, answers jsonb not null default '{}'::jsonb,
  external_completed boolean not null default false, submitted_at timestamptz not null default now()
);
create table if not exists public.school_survey_completions (
  survey_id uuid not null references public.school_surveys(id) on delete cascade,
  learner_id uuid not null references public.learners(id) on delete cascade,
  parent_phone text not null,
  completed_at timestamptz not null default now(),
  primary key(survey_id, learner_id, parent_phone)
);
create unique index if not exists school_survey_parent_response_idx on public.school_survey_responses(survey_id, learner_id, parent_phone) where parent_phone is not null;
create index if not exists school_meetings_school_date_idx on public.school_meetings(school_id, meeting_date desc);
create index if not exists school_surveys_school_created_idx on public.school_surveys(school_id, created_at desc);
alter table public.school_meetings enable row level security;
alter table public.school_meeting_acknowledgements enable row level security;
alter table public.school_surveys enable row level security;
alter table public.school_survey_responses enable row level security;
alter table public.school_survey_completions enable row level security;
comment on table public.school_meeting_acknowledgements is 'Parent acknowledgement wording: I confirm that I have received and read these meeting minutes.';
