create index if not exists weekly_activity_plans_school_class_date_idx
  on public.weekly_activity_plans (school_id, classroom_id, activity_date);

create index if not exists learner_activity_outcomes_school_class_status_idx
  on public.learner_activity_outcomes (school_id, classroom_id, support_status);

create index if not exists learner_activity_outcomes_school_learner_area_idx
  on public.learner_activity_outcomes (school_id, learner_id, developmental_area);

create index if not exists activity_library_school_theme_name_idx
  on public.activity_library (school_id, theme, activity_name);

create index if not exists learners_school_classroom_idx
  on public.learners (school_id, classroom_id);

alter table public.learner_activity_outcomes
  add column if not exists updated_at timestamptz not null default now();

alter table public.activity_library
  add column if not exists archived boolean not null default false;

with duplicate_activities as (
  select id,
         row_number() over (
           partition by school_id, lower(coalesce(theme, '')), lower(activity_name)
           order by id
         ) as duplicate_number
  from public.activity_library
  where archived = false
)
update public.activity_library as library
set archived = true
from duplicate_activities
where library.id = duplicate_activities.id
  and duplicate_activities.duplicate_number > 1;

create unique index if not exists activity_library_school_theme_name_unique_idx
  on public.activity_library (
    school_id,
    lower(coalesce(theme, '')),
    lower(activity_name)
  )
  where archived = false;

create or replace function public.replace_weekly_activity_plan(
  p_school_id bigint,
  p_classroom_id bigint,
  p_dates date[],
  p_rows jsonb
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  delete from public.weekly_activity_plans
  where school_id = p_school_id
    and classroom_id = p_classroom_id
    and activity_date = any(p_dates);

  insert into public.weekly_activity_plans (
    school_id, classroom_id, activity_date, developmental_area, theme,
    activity_library_id, activity_name, description, day_type,
    plan_group_id, planned_by
  )
  select
    p_school_id,
    p_classroom_id,
    x.activity_date,
    x.developmental_area,
    x.theme,
    x.activity_library_id,
    x.activity_name,
    x.description,
    x.day_type,
    x.plan_group_id,
    x.planned_by
  from jsonb_to_recordset(p_rows) as x(
    activity_date date,
    developmental_area text,
    theme text,
    activity_library_id bigint,
    activity_name text,
    description text,
    day_type text,
    plan_group_id text,
    planned_by uuid
  );
end;
$$;

create or replace function public.complete_classroom_activity(
  p_school_id bigint,
  p_plan_id bigint,
  p_recorded_by uuid,
  p_support_rows jsonb
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_plan public.weekly_activity_plans%rowtype;
  v_row record;
  v_existing_id bigint;
begin
  select * into v_plan
  from public.weekly_activity_plans
  where id = p_plan_id and school_id = p_school_id
  for update;

  if not found then
    raise exception 'Activity plan not found.';
  end if;

  delete from public.learner_activity_outcomes
  where weekly_plan_id = p_plan_id and school_id = p_school_id;

  for v_row in
    select * from jsonb_to_recordset(p_support_rows) as x(
      learner_id bigint,
      support_status text,
      observation text
    )
  loop
    select id into v_existing_id
    from public.learner_activity_outcomes
    where school_id = p_school_id
      and learner_id = v_row.learner_id
      and developmental_area = v_plan.developmental_area
      and outcome_status = 'needs_support'
      and coalesce(support_status, 'new') <> 'resolved'
      and weekly_plan_id is distinct from p_plan_id
    order by created_at desc
    limit 1
    for update;

    if v_existing_id is not null then
      update public.learner_activity_outcomes
      set weekly_plan_id = p_plan_id,
          classroom_id = v_plan.classroom_id,
          theme = v_plan.theme,
          activity_date = v_plan.activity_date,
          activity_name = v_plan.activity_name,
          support_status = coalesce(v_row.support_status, 'new'),
          observation = nullif(v_row.observation, ''),
          recorded_by = p_recorded_by,
          updated_at = now()
      where id = v_existing_id;
    else
      insert into public.learner_activity_outcomes (
        school_id, classroom_id, learner_id, weekly_plan_id,
        developmental_area, theme, activity_date, activity_name,
        outcome_status, support_status, observation, recorded_by
      ) values (
        p_school_id, v_plan.classroom_id, v_row.learner_id, p_plan_id,
        v_plan.developmental_area, v_plan.theme, v_plan.activity_date,
        v_plan.activity_name, 'needs_support',
        coalesce(v_row.support_status, 'new'),
        nullif(v_row.observation, ''), p_recorded_by
      );
    end if;

    v_existing_id := null;
  end loop;

  update public.weekly_activity_plans
  set completed = true,
      completed_at = now(),
      completed_by = p_recorded_by
  where id = p_plan_id and school_id = p_school_id;
end;
$$;
