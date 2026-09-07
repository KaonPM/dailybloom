-- Aggregated school adoption data for the weekly Principal/Admin digest.
-- Keeping the aggregation in Postgres avoids loading every learner and activity
-- record into the scheduled route as the number of schools grows.

create or replace function public.school_adoption_weekly_health(p_week_start date)
returns table (
  school_id bigint,
  school_name text,
  classroom_count bigint,
  learner_count bigint,
  practitioner_count bigint,
  attendance_count bigint,
  summary_count bigint,
  broadcast_count bigint
)
language sql
stable
as $$
  select
    school.id,
    school.school_name,
    (select count(*) from public.classrooms classroom where classroom.school_id = school.id),
    (select count(*) from public.learners learner where learner.school_id = school.id and coalesce(learner.is_deleted, false) = false),
    (select count(*) from public.profiles practitioner where practitioner.school_id = school.id and practitioner.role = 'teacher' and coalesce(practitioner.is_active, true) = true),
    (select count(*) from public.attendance attendance where attendance.school_id = school.id and attendance.attendance_date >= p_week_start),
    (select count(*) from public.summaries summary where summary.school_id = school.id and summary.created_at >= p_week_start::timestamptz),
    (select count(*) from public.broadcasts broadcast where broadcast.school_id = school.id and broadcast.created_at >= p_week_start::timestamptz)
  from public.schools school
  where coalesce(lower(school.status), 'active') <> 'inactive'
  order by school.school_name;
$$;

create index if not exists attendance_school_date_adoption_idx
  on public.attendance (school_id, attendance_date);
create index if not exists summaries_school_created_adoption_idx
  on public.summaries (school_id, created_at);
create index if not exists broadcasts_school_created_adoption_idx
  on public.broadcasts (school_id, created_at);
