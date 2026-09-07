-- Extend the weekly digest aggregate without changing its existing migration.
drop function if exists public.school_adoption_weekly_health(date);

create function public.school_adoption_weekly_health(p_week_start date)
returns table (
  school_id bigint, school_name text, classroom_count bigint, learner_count bigint,
  practitioner_count bigint, attendance_count bigint, summary_count bigint,
  broadcast_count bigint, classroom_activity_count bigint, homework_count bigint
)
language sql stable
as $$
  select school.id, school.school_name,
    (select count(*) from public.classrooms classroom where classroom.school_id = school.id),
    (select count(*) from public.learners learner where learner.school_id = school.id and coalesce(learner.is_deleted, false) = false),
    (select count(*) from public.profiles practitioner where practitioner.school_id = school.id and practitioner.role = 'teacher' and coalesce(practitioner.is_active, true) = true),
    (select count(*) from public.attendance attendance where attendance.school_id = school.id and attendance.attendance_date >= p_week_start),
    (select count(*) from public.summaries summary where summary.school_id = school.id and summary.created_at >= p_week_start::timestamptz),
    (select count(*) from public.broadcasts broadcast where broadcast.school_id = school.id and broadcast.created_at >= p_week_start::timestamptz),
    (select count(*) from public.weekly_activity_plans activity where activity.school_id = school.id and activity.activity_date >= p_week_start),
    (select count(*) from public.homework_assignments homework where homework.school_id = school.id and homework.activity_date >= p_week_start)
  from public.schools school
  where coalesce(lower(school.status), 'active') <> 'inactive'
  order by school.school_name;
$$;

create index if not exists weekly_activity_plans_school_date_adoption_idx on public.weekly_activity_plans (school_id, activity_date);
create index if not exists homework_assignments_school_date_adoption_idx on public.homework_assignments (school_id, activity_date);

alter table public.profiles add column if not exists school_adoption_weekly_digest_opt_out boolean not null default false;
