-- The schools table does not have an updated_at column.  Redefine the demo
-- school action to update only the fields that exist, while preserving the
-- original audit fields and the subscription billing pause.

create or replace function public.set_dailybloom_demo_school(
  target_school_id bigint,
  demo_reason text,
  actor_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  target_school public.schools%rowtype;
begin
  if char_length(trim(coalesce(demo_reason, ''))) < 3 then
    raise exception 'A demo-school reason of at least 3 characters is required.';
  end if;

  select *
    into target_school
    from public.schools
   where id = target_school_id
   for update;

  if target_school.id is null then
    raise exception 'School % was not found.', target_school_id;
  end if;

  update public.schools
     set is_demo_school = true,
         demo_school_reason = trim(demo_reason),
         demo_school_set_at = now(),
         demo_school_set_by = actor_id
   where id = target_school_id;

  update public.school_subscriptions
     set next_billing_date = null,
         updated_at = now()
   where school_id = target_school_id;

  return jsonb_build_object(
    'school_id', target_school_id,
    'is_demo_school', true,
    'message', 'DailyBloom billing is paused for this Demo school.'
  );
end;
$$;

revoke all on function public.set_dailybloom_demo_school(bigint, text, uuid)
  from public, anon, authenticated;
grant execute on function public.set_dailybloom_demo_school(bigint, text, uuid)
  to service_role;
