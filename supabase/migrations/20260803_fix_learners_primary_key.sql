-- Learners are identified throughout DailyBloom by their UUID `id`.
-- The legacy database primary key was incorrectly attached to `name`, which
-- prevented two learners from sharing the same preferred name.

begin;

lock table public.learners in access exclusive mode;

-- Older rows should already have UUIDs, but repair any legacy null IDs before
-- making the UUID column the primary key.
update public.learners
set id = gen_random_uuid()
where id is null;

do $$
begin
  if exists (
    select 1
    from public.learners
    group by id
    having count(*) > 1
  ) then
    raise exception
      'Cannot move learners primary key to id because duplicate learner UUIDs exist.';
  end if;
end;
$$;

alter table public.learners
  drop constraint learners_pkey;

alter table public.learners
  add constraint learners_pkey primary key (id);

-- Names are intentionally not unique. This index retains fast school/name
-- lookup without preventing different learners from having the same name.
create index if not exists learners_school_name_idx
  on public.learners (school_id, name);

commit;
