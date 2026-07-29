begin;

alter table public.homework_assignments
  add column if not exists due_date date;

update public.homework_assignments
set due_date = activity_date
where due_date is null;

alter table public.homework_assignments
  alter column due_date set not null;

alter table public.homework_assignments
  drop constraint if exists homework_assignments_due_date_check;

alter table public.homework_assignments
  add constraint homework_assignments_due_date_check
  check (due_date >= activity_date);

drop function if exists public.replace_classroom_homework(
  bigint,
  bigint,
  date,
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
    due_date,
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
    greatest(
      p_activity_date,
      case
        when (item->>'due_date') ~ '^\d{4}-\d{2}-\d{2}$'
          then (item->>'due_date')::date
        else p_activity_date
      end
    ),
    case
      when (item->>'homework_id') ~ '^[0-9]+$'
        then (item->>'homework_id')::bigint
      else null
    end,
    nullif(left(trim(item->>'instruction_note'), 500), ''),
    0,
    p_assigned_by
  from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) item
  where item->>'position' = '0'
    and (
      (
        (item->>'homework_id') ~ '^[0-9]+$'
        and exists (
          select 1
          from public.homework_library library
          where library.id = (item->>'homework_id')::bigint
            and library.school_id = p_school_id
            and library.archived = false
        )
      )
      or (
        coalesce(item->>'homework_id', '') = ''
        and nullif(trim(item->>'instruction_note'), '') is not null
      )
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
