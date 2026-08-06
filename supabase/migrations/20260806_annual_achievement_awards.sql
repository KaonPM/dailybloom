-- Achievement awards are an annual practitioner nomination workflow.
-- Report periods are deliberately no longer used to create or group certificates.
-- Learner IDs are UUIDs throughout this workflow; they are never cast to bigint.

alter table public.achievement_awards
  add column if not exists approved_at timestamptz,
  add column if not exists declined_at timestamptz,
  add column if not exists declined_by uuid,
  add column if not exists decline_reason text;

alter table public.achievement_awards
  alter column report_period_id drop not null;

update public.achievement_awards
set academic_year = coalesce(
      academic_year,
      award_year,
      extract(year from coalesce(issued_at, created_at, now()))::integer
    ),
    award_year = coalesce(
      award_year,
      academic_year,
      extract(year from coalesce(issued_at, created_at, now()))::integer
    ),
    report_period_id = null;

drop index if exists public.achievement_awards_active_unique_idx;
drop index if exists public.achievement_awards_school_learner_period_idx;

create index if not exists achievement_awards_school_learner_year_idx
  on public.achievement_awards (school_id, learner_id, academic_year, created_at desc);

create or replace function public.prepare_annual_achievement_award()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_year integer;
begin
  v_year := coalesce(
    new.academic_year,
    new.award_year,
    extract(year from coalesce(new.issued_at, new.created_at, now()))::integer
  );

  new.academic_year := v_year;
  new.award_year := v_year;
  new.report_period_id := null;

  if new.deleted_at is null
     and new.workflow_status in ('nominated', 'issued')
     and exists (
       select 1
       from public.achievement_awards existing_award
       where existing_award.school_id = new.school_id
         and existing_award.learner_id = new.learner_id
         and existing_award.academic_year = new.academic_year
         and lower(existing_award.award_name) = lower(new.award_name)
         and existing_award.deleted_at is null
         and existing_award.workflow_status in ('nominated', 'issued')
         and existing_award.id is distinct from new.id
     ) then
    raise exception 'This learner already has an active nomination or issued annual award with this name.';
  end if;

  return new;
end;
$$;

drop trigger if exists prepare_annual_achievement_award_trigger
  on public.achievement_awards;

create trigger prepare_annual_achievement_award_trigger
before insert or update on public.achievement_awards
for each row execute function public.prepare_annual_achievement_award();

-- Historical certificate-download rows used a bigint learner_id, while
-- public.learners.id is UUID. Preserve historic audit rows and record all new
-- download events against an explicit UUID column instead of coercing IDs.
alter table if exists public.certificate_reprints
  add column if not exists learner_uuid uuid;

alter table if exists public.certificate_reprints
  alter column learner_id drop not null;

update public.certificate_reprints as reprint
set learner_uuid = award.learner_id
from public.achievement_awards as award
where award.id = reprint.certificate_id
  and reprint.learner_uuid is null;

create index if not exists certificate_reprints_learner_uuid_idx
  on public.certificate_reprints (learner_uuid, printed_at desc);

drop policy if exists "Award workflow create" on public.achievement_awards;
create policy "Award workflow create"
on public.achievement_awards for insert
to authenticated
with check (
  achievement_awards.workflow_status = 'nominated'
  and achievement_awards.nominated_by = auth.uid()
  and achievement_awards.teacher_id = auth.uid()
  and achievement_awards.report_period_id is null
  and exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.school_id = achievement_awards.school_id
      and profiles.role in ('teacher', 'practitioner', 'educator')
  )
  and exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      -- Some profiles pre-date the classroom_id column. JSON access keeps
      -- this policy compatible with both profile shapes.
      and to_jsonb(profiles) ->> 'classroom_id' = achievement_awards.classroom_id::text
  )
);
