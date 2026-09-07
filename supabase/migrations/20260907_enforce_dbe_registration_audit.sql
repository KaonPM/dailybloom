-- Ensure direct authenticated DBE registration writes cannot bypass the
-- existing internal security audit trail. Server-side service-role writes
-- continue to use the audited API route and are intentionally skipped here
-- to avoid duplicate events.

create or replace function public.audit_authenticated_dbe_registration_save()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  actor_profile public.profiles%rowtype;
  actor_id uuid := auth.uid();
begin
  -- A service-role request has no end-user identity in auth.uid(). Its audit
  -- event is written by the server route with the resolved staff role. A
  -- browser-originated authenticated write must be audited atomically here.
  if actor_id is null then
    return new;
  end if;

  select *
  into actor_profile
  from public.profiles
  where id = actor_id;

  insert into public.security_audit_log (
    actor_id,
    actor_name,
    actor_role,
    school_id,
    action,
    target_type,
    target_id,
    details
  )
  values (
    actor_id,
    coalesce(actor_profile.full_name, actor_profile.email),
    actor_profile.role,
    new.school_id,
    'dbe.registration_saved',
    'dbe_registration',
    new.id::text,
    jsonb_build_object('registration_id', new.id)
  );

  return new;
end;
$$;

revoke all on function public.audit_authenticated_dbe_registration_save()
  from public;

drop trigger if exists dbe_registration_authenticated_audit
  on public.dbe_registration;

create trigger dbe_registration_authenticated_audit
after insert or update on public.dbe_registration
for each row
execute function public.audit_authenticated_dbe_registration_save();
