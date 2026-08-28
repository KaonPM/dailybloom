-- A learner selected for support during activity completion now records the
-- first practical intervention immediately. This keeps the support case tied
-- to the activity's developmental area and creates an auditable first step.
create or replace function public.complete_classroom_activity(
  p_school_id bigint,
  p_plan_id bigint,
  p_recorded_by uuid,
  p_support_rows jsonb,
  p_strength_rows jsonb default '[]'::jsonb
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

  if not found then raise exception 'Activity plan not found.'; end if;
  if v_plan.completed then return; end if;

  for v_row in
    select * from jsonb_to_recordset(coalesce(p_support_rows, '[]'::jsonb)) as x(
      learner_id uuid,
      support_status text,
      observation text,
      intervention text
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
        v_plan.activity_name, 'needs_support', coalesce(v_row.support_status, 'new'),
        nullif(v_row.observation, ''), p_recorded_by
      ) returning id into v_existing_id;
    end if;

    insert into public.learner_support_updates (
      school_id, classroom_id, learner_id, outcome_id, support_status,
      intervention, progress_note, recorded_by
    ) values (
      p_school_id, v_plan.classroom_id, v_row.learner_id, v_existing_id,
      coalesce(v_row.support_status, 'new'), nullif(v_row.intervention, ''),
      nullif(v_row.observation, ''), p_recorded_by
    );

    v_existing_id := null;
  end loop;

  for v_row in
    select * from jsonb_to_recordset(coalesce(p_strength_rows, '[]'::jsonb)) as x(
      learner_id uuid,
      observation text
    )
  loop
    insert into public.learner_activity_outcomes (
      school_id, classroom_id, learner_id, weekly_plan_id,
      developmental_area, theme, activity_date, activity_name,
      outcome_status, observation, recorded_by
    ) values (
      p_school_id, v_plan.classroom_id, v_row.learner_id, p_plan_id,
      v_plan.developmental_area, v_plan.theme, v_plan.activity_date,
      v_plan.activity_name, 'exceeding_expectations', nullif(v_row.observation, ''), p_recorded_by
    );
  end loop;

  update public.weekly_activity_plans
  set completed = true, completed_at = now(), completed_by = p_recorded_by
  where id = p_plan_id and school_id = p_school_id;
end;
$$;
