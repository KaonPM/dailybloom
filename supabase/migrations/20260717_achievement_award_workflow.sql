alter table public.achievement_awards
  add column if not exists award_category text,
  add column if not exists workflow_status text not null default 'issued',
  add column if not exists nominated_by uuid,
  add column if not exists approved_by uuid,
  add column if not exists issued_at timestamptz,
  add column if not exists revoked_at timestamptz,
  add column if not exists revoked_by uuid,
  add column if not exists revoke_reason text,
  add column if not exists replacement_of bigint references public.achievement_awards(id),
  add column if not exists academic_year integer;

update public.achievement_awards
set workflow_status = case when deleted_at is null then 'issued' else 'revoked' end,
    issued_at = coalesce(issued_at, created_at),
    academic_year = coalesce(academic_year, award_year)
where issued_at is null or academic_year is null;

alter table public.report_periods
  add column if not exists academic_year integer;

update public.report_periods
set academic_year = coalesce(
  academic_year,
  nullif(substring(title from '(20[0-9]{2})'), '')::integer,
  extract(year from created_at)::integer
);

with duplicate_awards as (
  select id,
         row_number() over (
           partition by school_id, learner_id, report_period_id, lower(award_name)
           order by coalesce(created_at, now()), id
         ) as duplicate_number
  from public.achievement_awards
  where deleted_at is null and workflow_status = 'issued'
)
update public.achievement_awards as award
set workflow_status = 'revoked',
    deleted_at = now(),
    revoked_at = now(),
    revoke_reason = 'Duplicate record consolidated during award workflow migration'
from duplicate_awards
where award.id = duplicate_awards.id
  and duplicate_awards.duplicate_number > 1;

create unique index if not exists achievement_awards_active_unique_idx
  on public.achievement_awards (
    school_id, learner_id, report_period_id, lower(award_name)
  )
  where deleted_at is null and workflow_status = 'issued';

create index if not exists achievement_awards_school_status_issued_idx
  on public.achievement_awards (school_id, workflow_status, issued_at desc);

create index if not exists achievement_awards_school_learner_period_idx
  on public.achievement_awards (school_id, learner_id, report_period_id);

alter table public.achievement_awards enable row level security;

drop policy if exists "Award workflow school read" on public.achievement_awards;
create policy "Award workflow school read"
on public.achievement_awards for select
to authenticated
using (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
      and (profiles.school_id = achievement_awards.school_id or profiles.role = 'master')
  )
);

drop policy if exists "Award workflow create" on public.achievement_awards;
create policy "Award workflow create"
on public.achievement_awards for insert
to authenticated
with check (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
      and (profiles.school_id = achievement_awards.school_id or profiles.role = 'master')
      and (
        profiles.role in ('principal', 'admin', 'master')
        or (
          profiles.role = 'teacher'
          and achievement_awards.workflow_status = 'nominated'
          and achievement_awards.nominated_by = auth.uid()
          and achievement_awards.teacher_id = auth.uid()
        )
      )
  )
);

drop policy if exists "Award workflow principal update" on public.achievement_awards;
create policy "Award workflow principal update"
on public.achievement_awards for update
to authenticated
using (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
      and (profiles.school_id = achievement_awards.school_id or profiles.role = 'master')
      and profiles.role in ('principal', 'admin', 'master')
  )
)
with check (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
      and (profiles.school_id = achievement_awards.school_id or profiles.role = 'master')
      and profiles.role in ('principal', 'admin', 'master')
  )
);

create or replace function public.reissue_achievement_award(
  p_original_id bigint,
  p_payload jsonb
)
returns bigint
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_new_id bigint;
begin
  update public.achievement_awards
  set workflow_status = 'revoked',
      deleted_at = now(),
      revoked_at = now(),
      revoked_by = auth.uid(),
      revoke_reason = 'Corrected and reissued'
  where id = p_original_id;

  if not found then
    raise exception 'Original certificate was not found.';
  end if;

  insert into public.achievement_awards (
    school_id, learner_id, classroom_id, teacher_id, report_period_id,
    award_name, award_category, award_reason, teacher_name, principal_name,
    award_year, academic_year, workflow_status, approved_by, issued_at,
    certificate_generated, replacement_of
  ) values (
    (p_payload->>'school_id')::bigint,
    (p_payload->>'learner_id')::bigint,
    nullif(p_payload->>'classroom_id', '')::bigint,
    nullif(p_payload->>'teacher_id', '')::uuid,
    (p_payload->>'report_period_id')::bigint,
    p_payload->>'award_name',
    p_payload->>'award_category',
    p_payload->>'award_reason',
    p_payload->>'teacher_name',
    p_payload->>'principal_name',
    (p_payload->>'award_year')::integer,
    (p_payload->>'academic_year')::integer,
    'issued',
    auth.uid(),
    now(),
    true,
    p_original_id
  ) returning id into v_new_id;

  return v_new_id;
end;
$$;

create table if not exists public.certificate_reprints (
  id bigint generated by default as identity primary key,
  certificate_id bigint not null references public.achievement_awards(id),
  school_id bigint not null,
  learner_id bigint not null,
  printed_at timestamptz not null default now(),
  action text not null default 'download',
  performed_by uuid default auth.uid()
);

alter table public.certificate_reprints
  add column if not exists performed_by uuid default auth.uid(),
  add column if not exists action text not null default 'download';

create index if not exists certificate_reprints_certificate_idx
  on public.certificate_reprints (certificate_id, printed_at desc);

alter table public.certificate_reprints enable row level security;

drop policy if exists "School staff can view certificate reprints" on public.certificate_reprints;
create policy "School staff can view certificate reprints"
on public.certificate_reprints for select
to authenticated
using (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
      and (profiles.school_id = certificate_reprints.school_id or profiles.role = 'master')
  )
);

drop policy if exists "School staff can create certificate reprints" on public.certificate_reprints;
create policy "School staff can create certificate reprints"
on public.certificate_reprints for insert
to authenticated
with check (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
      and (profiles.school_id = certificate_reprints.school_id or profiles.role = 'master')
  )
);
