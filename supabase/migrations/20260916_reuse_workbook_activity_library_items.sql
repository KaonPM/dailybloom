-- A workbook page set can be planned on more than one day. Reuse its active
-- activity-library entry instead of failing the library's uniqueness rule.
create or replace function public.create_workbook_assignment(
  target_school bigint, target_classroom bigint, target_resource bigint, pages integer[],
  entity_type text, title text, instructions text, learning_focus text, activity_day date, due_day date, actor uuid
) returns bigint language plpgsql security definer set search_path = public as $$
declare
  target_id bigint;
  library_id bigint;
  monday date;
begin
  if not exists(select 1 from public.classrooms where id = target_classroom and school_id = target_school) then
    raise exception 'Classroom unavailable.';
  end if;
  if not exists(select 1 from public.learning_resources where id = target_resource and status = 'published'
    and catalogue_status = 'current' and (school_id is null or school_id = target_school)
    and page_count >= (select max(p) from unnest(pages) p)) then
    raise exception 'Workbook unavailable or invalid pages.';
  end if;
  if cardinality(pages) = 0 or exists(select 1 from unnest(pages) p where p is null or p < 1) then
    raise exception 'Select valid pages.';
  end if;

  if entity_type = 'activity' then
    select id into library_id
    from public.activity_library
    where school_id = target_school
      and lower(coalesce(theme, '')) = lower('Grade R: DBE Workbook')
      and lower(activity_name) = lower(title)
      and archived = false
    order by id
    limit 1;

    if library_id is null then
      begin
        insert into public.activity_library(school_id, developmental_area, theme, activity_name, description, created_by)
          values(target_school, learning_focus, 'Grade R: DBE Workbook', title, instructions, actor)
          returning id into library_id;
      exception when unique_violation then
        select id into library_id
        from public.activity_library
        where school_id = target_school
          and lower(coalesce(theme, '')) = lower('Grade R: DBE Workbook')
          and lower(activity_name) = lower(title)
          and archived = false
        order by id
        limit 1;
      end;
    end if;

    insert into public.weekly_activity_plans(school_id, classroom_id, activity_date, developmental_area,
      theme, activity_library_id, activity_name, description, day_type, planned_by)
      values(target_school, target_classroom, activity_day, learning_focus, 'Grade R: DBE Workbook', library_id, title, instructions, 'teaching_day', actor)
      returning id into target_id;
    insert into public.activity_learning_resources(weekly_plan_id, resource_id, school_id, classroom_id, selected_pages, page_from, page_to, created_by)
      values(target_id, target_resource, target_school, target_classroom, pages, (select min(p) from unnest(pages) p), (select max(p) from unnest(pages) p), actor);
  elsif entity_type = 'homework' then
    monday := activity_day - (extract(isodow from activity_day)::integer - 1);
    if extract(isodow from activity_day) > 5 then raise exception 'Choose a teaching weekday.'; end if;
    insert into public.homework_assignments(school_id, classroom_id, week_start, activity_date, due_date, instruction_note, position, assigned_by)
      values(target_school, target_classroom, monday, activity_day, greatest(activity_day, due_day), left(title || E'\n' || instructions, 500), 0, actor)
      returning id into target_id;
    insert into public.homework_learning_resources(homework_assignment_id, resource_id, school_id, classroom_id, selected_pages, page_from, page_to, created_by)
      values(target_id, target_resource, target_school, target_classroom, pages, (select min(p) from unnest(pages) p), (select max(p) from unnest(pages) p), actor);
  else
    raise exception 'Invalid assignment type.';
  end if;
  return target_id;
end;
$$;

revoke all on function public.create_workbook_assignment(bigint,bigint,bigint,integer[],text,text,text,text,date,date,uuid) from public, anon, authenticated;
grant execute on function public.create_workbook_assignment(bigint,bigint,bigint,integer[],text,text,text,text,date,date,uuid) to service_role;
