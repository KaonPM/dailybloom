-- Keep the legacy school status label and the active-access flag aligned.
-- Existing deployments may already have is_active; this migration is safe there.
alter table public.schools
  add column if not exists is_active boolean;

update public.schools
set is_active = case
  when lower(coalesce(status, 'active')) = 'active' then true
  else false
end
where is_active is null;

alter table public.schools
  alter column is_active set default true,
  alter column is_active set not null;

create or replace function public.sync_school_access_status()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    new.is_active := coalesce(new.is_active, lower(coalesce(new.status, 'active')) = 'active');
    new.status := case when new.is_active then 'active' else coalesce(nullif(new.status, ''), 'suspended') end;
    return new;
  end if;

  if new.status is distinct from old.status then
    new.is_active := lower(coalesce(new.status, 'active')) = 'active';
  elsif new.is_active is distinct from old.is_active then
    new.status := case when new.is_active then 'active' else 'suspended' end;
  end if;

  return new;
end;
$$;

drop trigger if exists schools_sync_access_status on public.schools;
create trigger schools_sync_access_status
before insert or update of status, is_active on public.schools
for each row execute function public.sync_school_access_status();
