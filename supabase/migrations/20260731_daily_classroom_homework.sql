begin;

alter table public.homework_assignments
  add column if not exists activity_date date;

update public.homework_assignments
set activity_date = week_start
where activity_date is null;

alter table public.homework_assignments
  alter column activity_date set not null;

drop index if exists public.homework_assignments_week_position_uidx;

create unique index if not exists homework_assignments_day_position_uidx
  on public.homework_assignments (
    school_id,
    classroom_id,
    week_start,
    activity_date,
    position
  );

create index if not exists homework_assignments_class_day_idx
  on public.homework_assignments (classroom_id, activity_date desc);

drop function if exists public.replace_classroom_homework(
  bigint,
  bigint,
  date,
  uuid,
  jsonb
);

create or replace function public.replace_classroom_homework(
  p_school_id bigint,
  p_classroom_id bigint,
  p_week_start date,
  p_activity_date date,
  p_assigned_by uuid,
  p_items jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_activity_date < p_week_start
     or p_activity_date > (p_week_start + 4) then
    raise exception 'Homework date must be a teaching day in the selected week.';
  end if;

  if not exists (
    select 1
    from public.classrooms classroom
    where classroom.id = p_classroom_id
      and classroom.school_id = p_school_id
  ) then
    raise exception 'Classroom does not belong to this school.';
  end if;

  delete from public.homework_assignments
  where school_id = p_school_id
    and classroom_id = p_classroom_id
    and week_start = p_week_start
    and activity_date = p_activity_date;

  insert into public.homework_assignments (
    school_id,
    classroom_id,
    week_start,
    activity_date,
    homework_id,
    instruction_note,
    position,
    assigned_by
  )
  select
    p_school_id,
    p_classroom_id,
    p_week_start,
    p_activity_date,
    (item->>'homework_id')::bigint,
    nullif(left(trim(item->>'instruction_note'), 500), ''),
    0,
    p_assigned_by
  from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) item
  where (item->>'homework_id') ~ '^[0-9]+$'
    and item->>'position' = '0'
    and exists (
      select 1
      from public.homework_library library
      where library.id = (item->>'homework_id')::bigint
        and library.school_id = p_school_id
        and library.archived = false
    );
end;
$$;

revoke all on function public.replace_classroom_homework(
  bigint,
  bigint,
  date,
  date,
  uuid,
  jsonb
) from public, anon, authenticated;

grant execute on function public.replace_classroom_homework(
  bigint,
  bigint,
  date,
  date,
  uuid,
  jsonb
) to service_role;

commit;
