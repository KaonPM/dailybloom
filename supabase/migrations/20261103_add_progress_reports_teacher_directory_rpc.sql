-- Progress Reports uses this as a secure fallback when profile RLS does not
-- permit its normal teacher-directory query. Practitioners can see only their
-- own profile; authorised school report managers can see practitioners in
-- their own school.
drop function if exists public.get_school_teachers_for_attendance();

create or replace function public.get_school_teachers_for_attendance(p_school_id bigint)
returns setof public.profiles
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_school_id bigint;
  v_role text;
  v_permissions text[];
begin
  select membership.school_id, membership.role, membership.permissions
    into v_school_id, v_role, v_permissions
  from public.school_memberships membership
  where membership.user_id = auth.uid()
    and membership.school_id = p_school_id
    and membership.status = 'active'
  order by membership.school_id
  limit 1;

  if v_school_id is null then
    return;
  end if;

  if v_role = 'teacher' then
    return query
      select profile.*
      from public.profiles profile
      where profile.id = auth.uid()
        and profile.school_id = v_school_id;
    return;
  end if;

  if v_role in ('owner', 'principal')
     or (v_role = 'admin' and 'progress_reports.manage' = any(coalesce(v_permissions, '{}'::text[]))) then
    return query
      select profile.*
      from public.profiles profile
      where profile.school_id = v_school_id
        and lower(coalesce(profile.role, '')) in ('teacher', 'practitioner', 'educator')
      order by profile.created_at desc;
  end if;
end;
$$;

revoke all on function public.get_school_teachers_for_attendance(bigint) from public, anon, authenticated;
grant execute on function public.get_school_teachers_for_attendance(bigint) to authenticated;
