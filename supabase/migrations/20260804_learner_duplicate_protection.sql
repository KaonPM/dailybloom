-- Prevent new active learner duplicates without changing or deleting existing rows.
-- Existing duplicates can remain temporarily and should be reviewed by the school.

begin;

create or replace function public.normalized_learner_identifier(value text)
returns text
language sql
immutable
parallel safe
as $$
  select nullif(upper(regexp_replace(trim(coalesce(value, '')), '[^A-Za-z0-9]', '', 'g')), '');
$$;

create or replace function public.prevent_duplicate_active_learner()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  duplicate_name text;
begin
  if new.is_deleted is true then
    return new;
  end if;

  if public.normalized_learner_identifier(new.sa_id_number) is not null
     and (
       tg_op = 'INSERT'
       or new.school_id is distinct from old.school_id
       or new.is_deleted is distinct from old.is_deleted
       or public.normalized_learner_identifier(new.sa_id_number)
          is distinct from public.normalized_learner_identifier(old.sa_id_number)
     )
  then
    select coalesce(existing.legal_name, existing.name, 'Existing learner')
    into duplicate_name
    from public.learners existing
    where existing.school_id = new.school_id
      and existing.id is distinct from new.id
      and existing.is_deleted is not true
      and public.normalized_learner_identifier(existing.sa_id_number) =
          public.normalized_learner_identifier(new.sa_id_number)
    limit 1;

    if duplicate_name is not null then
      raise exception
        'A learner with this SA ID number already exists: %.',
        duplicate_name;
    end if;
  end if;

  duplicate_name := null;
  if public.normalized_learner_identifier(new.passport_number) is not null
     and (
       tg_op = 'INSERT'
       or new.school_id is distinct from old.school_id
       or new.is_deleted is distinct from old.is_deleted
       or public.normalized_learner_identifier(new.passport_number)
          is distinct from public.normalized_learner_identifier(old.passport_number)
     )
  then
    select coalesce(existing.legal_name, existing.name, 'Existing learner')
    into duplicate_name
    from public.learners existing
    where existing.school_id = new.school_id
      and existing.id is distinct from new.id
      and existing.is_deleted is not true
      and public.normalized_learner_identifier(existing.passport_number) =
          public.normalized_learner_identifier(new.passport_number)
    limit 1;

    if duplicate_name is not null then
      raise exception
        'A learner with this passport number already exists: %.',
        duplicate_name;
    end if;
  end if;

  duplicate_name := null;
  if public.normalized_learner_identifier(new.birth_certificate_number) is not null
     and (
       tg_op = 'INSERT'
       or new.school_id is distinct from old.school_id
       or new.is_deleted is distinct from old.is_deleted
       or public.normalized_learner_identifier(new.birth_certificate_number)
          is distinct from public.normalized_learner_identifier(old.birth_certificate_number)
     )
  then
    select coalesce(existing.legal_name, existing.name, 'Existing learner')
    into duplicate_name
    from public.learners existing
    where existing.school_id = new.school_id
      and existing.id is distinct from new.id
      and existing.is_deleted is not true
      and public.normalized_learner_identifier(existing.birth_certificate_number) =
          public.normalized_learner_identifier(new.birth_certificate_number)
    limit 1;

    if duplicate_name is not null then
      raise exception
        'A learner with this birth certificate number already exists: %.',
        duplicate_name;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_duplicate_active_learner_trigger
  on public.learners;

create trigger prevent_duplicate_active_learner_trigger
before insert or update of
  school_id,
  sa_id_number,
  passport_number,
  birth_certificate_number,
  is_deleted
on public.learners
for each row
execute function public.prevent_duplicate_active_learner();

commit;
