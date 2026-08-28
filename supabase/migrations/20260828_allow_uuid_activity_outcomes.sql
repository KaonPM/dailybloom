-- The numeric learner ID is retained only as optional legacy history after the
-- UUID learner link is introduced. New activity outcomes must not require it.
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'learner_activity_outcomes'
      and column_name = 'legacy_learner_id'
  ) then
    alter table public.learner_activity_outcomes
      alter column legacy_learner_id drop not null;
  end if;
end;
$$;
