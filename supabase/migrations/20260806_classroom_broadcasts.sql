-- Classroom broadcasts let school leaders target a chosen class, while
-- practitioners are restricted by the application to their assigned class.

alter table public.broadcasts
  add column if not exists recipient_scope text not null default 'school',
  add column if not exists classroom_id bigint,
  add column if not exists classroom_name text,
  add column if not exists created_by uuid,
  add column if not exists created_by_name text;

update public.broadcasts
set recipient_scope = 'school'
where recipient_scope is null
   or recipient_scope not in ('school', 'classroom');

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'broadcasts_recipient_scope_check'
      and conrelid = 'public.broadcasts'::regclass
  ) then
    alter table public.broadcasts
      add constraint broadcasts_recipient_scope_check
      check (recipient_scope in ('school', 'classroom'));
  end if;
end;
$$;

create index if not exists broadcasts_school_scope_class_created_at_idx
  on public.broadcasts (school_id, recipient_scope, classroom_id, created_at desc);
