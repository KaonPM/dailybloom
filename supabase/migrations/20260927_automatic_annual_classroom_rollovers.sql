-- Records the once-per-school fallback rollover used only when a school did
-- not create a re-enrolment campaign for the new academic year.
create table if not exists public.school_automatic_rollovers (
  id uuid primary key default gen_random_uuid(),
  school_id bigint not null references public.schools(id) on delete cascade,
  academic_year integer not null check (academic_year between 2020 and 2100),
  allocated_count integer not null default 0 check (allocated_count >= 0),
  archived_grade_r_count integer not null default 0 check (archived_grade_r_count >= 0),
  awaiting_manual_count integer not null default 0 check (awaiting_manual_count >= 0),
  applied_at timestamptz not null default now(),
  unique (school_id, academic_year)
);

create index if not exists school_automatic_rollovers_year_idx
  on public.school_automatic_rollovers(academic_year, school_id);

alter table public.school_automatic_rollovers enable row level security;

comment on table public.school_automatic_rollovers is
  'Idempotency and outcome record for January classroom rollover when no re-enrolment campaign exists.';
