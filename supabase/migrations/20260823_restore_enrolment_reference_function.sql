-- Restores the atomic reference generator used by paper and digital enrolments.
-- Safe to run more than once.

create table if not exists public.school_enrolment_counters (
  school_id bigint not null references public.schools(id) on delete cascade,
  enrolment_year integer not null,
  last_number integer not null default 0,
  primary key (school_id, enrolment_year)
);

create or replace function public.next_school_enrolment_reference_for_year(
  p_school_id bigint,
  p_academic_year integer
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
  v_code text;
  v_number integer;
begin
  select school_name into v_name
  from public.schools
  where id = p_school_id;

  if v_name is null then
    raise exception 'School not found';
  end if;

  select coalesce(nullif(string_agg(left(word, 1), ''), ''), 'SCH')
  into v_code
  from regexp_split_to_table(trim(v_name), '[[:space:]]+') word;

  v_code := upper(left(regexp_replace(v_code, '[^A-Z]', '', 'g'), 5));
  if v_code = '' then
    v_code := 'SCH';
  end if;

  insert into public.school_enrolment_counters (
    school_id,
    enrolment_year,
    last_number
  )
  values (p_school_id, p_academic_year, 1)
  on conflict (school_id, enrolment_year)
  do update set last_number = public.school_enrolment_counters.last_number + 1
  returning last_number into v_number;

  return v_code || '-' || p_academic_year::text || '-' || lpad(v_number::text, 4, '0');
end;
$$;

revoke all on function public.next_school_enrolment_reference_for_year(bigint, integer) from public, anon, authenticated;
grant execute on function public.next_school_enrolment_reference_for_year(bigint, integer) to service_role;

notify pgrst, 'reload schema';
