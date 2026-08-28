-- Some existing projects retained the original numeric learner column as a
-- required legacy field after the UUID learner link was added.  New outcomes
-- use the UUID link and must therefore be allowed to leave this old value null.
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'learner_activity_outcomes'
      and column_name = 'legacy_learner_id'
      and is_nullable = 'NO'
  ) then
    alter table public.learner_activity_outcomes
      alter column legacy_learner_id drop not null;
  end if;
end;
$$;
