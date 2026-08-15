-- Keep the existing per-school, per-year counter behaviour while avoiding a
-- PL/pgSQL variable name that conflicts with the counter table column.
create or replace function public.next_school_enrolment_reference(p_school_id bigint)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  school_name text;
  school_code text;
  v_enrolment_year integer := extract(year from now())::integer;
  next_number integer;
begin
  select school.school_name into school_name
  from public.schools as school
  where school.id = p_school_id;
  if school_name is null then
    raise exception 'School not found';
  end if;

  select coalesce(nullif(string_agg(left(word, 1), ''), ''), 'SCH')
  into school_code
  from regexp_split_to_table(trim(school_name), '[[:space:]]+') as word;
  school_code := upper(left(regexp_replace(school_code, '[^A-Z]', '', 'g'), 5));
  if school_code = '' then school_code := 'SCH'; end if;

  insert into public.school_enrolment_counters as counter (school_id, enrolment_year, last_number)
  values (p_school_id, v_enrolment_year, 1)
  on conflict on constraint school_enrolment_counters_pkey
  do update set last_number = counter.last_number + 1
  returning last_number into next_number;

  return school_code || '-' || v_enrolment_year::text || '-' || lpad(next_number::text, 4, '0');
end;
$$;
