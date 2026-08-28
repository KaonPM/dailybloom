-- Learner records use UUID primary keys. Earlier activity-outcome tables in
-- some schools still used a numeric learner_id, which breaks completion as
-- soon as a practitioner selects a learner who needs support.
do $$
declare
  learner_id_type text;
begin
  select data_type
    into learner_id_type
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'learner_activity_outcomes'
    and column_name = 'learner_id';

  if learner_id_type is not null and learner_id_type <> 'uuid' then
    alter table public.learner_activity_outcomes
      rename column learner_id to legacy_learner_id;

    alter table public.learner_activity_outcomes
      add column learner_id uuid references public.learners(id) on delete cascade;
  end if;
end;
$$;

create index if not exists learner_activity_outcomes_school_uuid_learner_area_idx
  on public.learner_activity_outcomes (school_id, learner_id, developmental_area);

-- Saving an updated weekly plan must not remove a completed activity or its
-- linked learner-support history. Only uncompleted plans are replaced.
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
    and activity_date = any(p_dates)
    and coalesce(completed, false) = false;

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
