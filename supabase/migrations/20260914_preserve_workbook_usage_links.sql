begin;

-- Preserve stable activity/assignment IDs when an existing plan is saved.
-- Explicitly removing an item still removes its dependent resource links.
create or replace function public.replace_weekly_activity_plan(
  p_school_id bigint, p_classroom_id bigint, p_dates date[], p_rows jsonb
) returns void language plpgsql security invoker set search_path = public as $$
declare
  row_data record;
  matched_id bigint;
  retained_ids bigint[] := '{}';
begin
  for row_data in select * from jsonb_to_recordset(p_rows) as x(
    activity_date date, developmental_area text, theme text, activity_library_id bigint,
    activity_name text, description text, day_type text, plan_group_id text, planned_by uuid
  ) loop
    if not row_data.activity_date = any(p_dates) then raise exception 'Activity date is outside the selected plan.'; end if;
    select id into matched_id from public.weekly_activity_plans
      where school_id = p_school_id and classroom_id = p_classroom_id
        and activity_date = row_data.activity_date
        and activity_library_id is not distinct from row_data.activity_library_id
        and not id = any(retained_ids)
      order by completed desc nulls last, id limit 1 for update;
    if matched_id is not null then
      update public.weekly_activity_plans set
        developmental_area = row_data.developmental_area, theme = row_data.theme,
        activity_name = row_data.activity_name, description = row_data.description,
        day_type = row_data.day_type, plan_group_id = row_data.plan_group_id
        where id = matched_id and coalesce(completed, false) = false;
    else
      insert into public.weekly_activity_plans(school_id, classroom_id, activity_date,
        developmental_area, theme, activity_library_id, activity_name, description,
        day_type, plan_group_id, planned_by)
      values(p_school_id, p_classroom_id, row_data.activity_date, row_data.developmental_area,
        row_data.theme, row_data.activity_library_id, row_data.activity_name, row_data.description,
        row_data.day_type, row_data.plan_group_id, row_data.planned_by) returning id into matched_id;
    end if;
    retained_ids := array_append(retained_ids, matched_id);
  end loop;
  delete from public.weekly_activity_plans where school_id = p_school_id and classroom_id = p_classroom_id
    and activity_date = any(p_dates) and coalesce(completed, false) = false and not id = any(retained_ids);
end;
$$;

create or replace function public.replace_classroom_homework(
  p_school_id bigint, p_classroom_id bigint, p_week_start date, p_activity_date date,
  p_assigned_by uuid, p_items jsonb
) returns void language plpgsql security definer set search_path = public as $$
declare item jsonb; library_id bigint; note text; deadline date;
begin
  if p_activity_date < p_week_start or p_activity_date > p_week_start + 4 then
    raise exception 'Homework date must be a teaching day in the selected week.';
  end if;
  if not exists(select 1 from public.classrooms where id = p_classroom_id and school_id = p_school_id) then
    raise exception 'Classroom does not belong to this school.';
  end if;
  item := coalesce(p_items, '[]'::jsonb)->0;
  if item is null then
    delete from public.homework_assignments where school_id = p_school_id and classroom_id = p_classroom_id
      and week_start = p_week_start and activity_date = p_activity_date;
    return;
  end if;
  library_id := nullif(item->>'homework_id', '')::bigint;
  note := nullif(left(trim(item->>'instruction_note'), 500), '');
  deadline := greatest(p_activity_date, coalesce(nullif(item->>'due_date', '')::date, p_activity_date));
  if library_id is not null and not exists(select 1 from public.homework_library where id = library_id and school_id = p_school_id and archived = false) then
    raise exception 'Homework attachment does not belong to this school.';
  end if;
  if library_id is null and note is null then raise exception 'Homework instructions or an attachment are required.'; end if;
  insert into public.homework_assignments(school_id, classroom_id, week_start, activity_date, due_date, homework_id, instruction_note, position, assigned_by)
  values(p_school_id, p_classroom_id, p_week_start, p_activity_date, deadline, library_id, note, 0, p_assigned_by)
  on conflict (school_id, classroom_id, week_start, activity_date, position)
  do update set due_date = excluded.due_date, homework_id = excluded.homework_id,
    instruction_note = excluded.instruction_note, assigned_by = excluded.assigned_by;
end;
$$;
revoke all on function public.replace_classroom_homework(bigint,bigint,date,date,uuid,jsonb) from public, anon, authenticated;
grant execute on function public.replace_classroom_homework(bigint,bigint,date,date,uuid,jsonb) to service_role;

create or replace function public.create_workbook_assignment(
  target_school bigint, target_classroom bigint, target_resource bigint, pages integer[],
  entity_type text, title text, instructions text, learning_focus text, activity_day date, due_day date, actor uuid
) returns bigint language plpgsql security definer set search_path = public as $$
declare target_id bigint; library_id bigint; monday date;
begin
  if not exists(select 1 from public.classrooms where id = target_classroom and school_id = target_school) then raise exception 'Classroom unavailable.'; end if;
  if not exists(select 1 from public.learning_resources where id = target_resource and status = 'published'
    and catalogue_status = 'current' and (school_id is null or school_id = target_school)
    and page_count >= (select max(p) from unnest(pages) p)) then raise exception 'Workbook unavailable or invalid pages.'; end if;
  if cardinality(pages) = 0 or exists(select 1 from unnest(pages) p where p is null or p < 1) then raise exception 'Select valid pages.'; end if;
  if entity_type = 'activity' then
    insert into public.activity_library(school_id, developmental_area, theme, activity_name, description, created_by)
      values(target_school, learning_focus, 'Grade R: DBE Workbook', title, instructions, actor) returning id into library_id;
    insert into public.weekly_activity_plans(school_id, classroom_id, activity_date, developmental_area,
      theme, activity_library_id, activity_name, description, day_type, planned_by)
      values(target_school, target_classroom, activity_day, learning_focus, 'Grade R: DBE Workbook', library_id, title, instructions, 'teaching_day', actor) returning id into target_id;
    insert into public.activity_learning_resources(weekly_plan_id, resource_id, school_id, classroom_id, selected_pages, page_from, page_to, created_by)
      values(target_id, target_resource, target_school, target_classroom, pages, (select min(p) from unnest(pages) p), (select max(p) from unnest(pages) p), actor);
  elsif entity_type = 'homework' then
    monday := activity_day - (extract(isodow from activity_day)::integer - 1);
    if extract(isodow from activity_day) > 5 then raise exception 'Choose a teaching weekday.'; end if;
    insert into public.homework_assignments(school_id, classroom_id, week_start, activity_date, due_date, instruction_note, position, assigned_by)
      values(target_school, target_classroom, monday, activity_day, greatest(activity_day, due_day), left(title || E'\n' || instructions, 500), 0, actor) returning id into target_id;
    insert into public.homework_learning_resources(homework_assignment_id, resource_id, school_id, classroom_id, selected_pages, page_from, page_to, created_by)
      values(target_id, target_resource, target_school, target_classroom, pages, (select min(p) from unnest(pages) p), (select max(p) from unnest(pages) p), actor);
  else raise exception 'Invalid assignment type.';
  end if;
  return target_id;
end;
$$;
revoke all on function public.create_workbook_assignment(bigint,bigint,bigint,integer[],text,text,text,text,date,date,uuid) from public, anon, authenticated;
grant execute on function public.create_workbook_assignment(bigint,bigint,bigint,integer[],text,text,text,text,date,date,uuid) to service_role;

commit;
