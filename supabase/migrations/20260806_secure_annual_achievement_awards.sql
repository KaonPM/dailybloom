-- Secure annual Achievement Awards workflow.
--
-- Assumptions verified against the current DailyBloom schema:
--   schools.id                 bigint
--   classrooms.id              bigint
--   learners.id                uuid
--   learners.school_id         bigint
--   learners.classroom_id      bigint
--   profiles.id                uuid
--
-- Existing awards and certificate audit rows are preserved. This migration only
-- validates new or changed award records and moves all mutations behind secure
-- RPCs. It deliberately does not alter learner UUIDs, delete historic records,
-- or apply any production data changes outside the normal migration process.

alter table public.achievement_awards
  add column if not exists approved_at timestamptz,
  add column if not exists declined_at timestamptz,
  add column if not exists declined_by uuid,
  add column if not exists decline_reason text,
  add column if not exists academic_year integer;

-- Preserve historic awards, while making the relationship constraints available
-- immediately for new data. NOT VALID avoids rejecting old records created by
-- earlier versions of the workflow.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'achievement_awards_school_id_fkey_secure') then
    alter table public.achievement_awards
      add constraint achievement_awards_school_id_fkey_secure
      foreign key (school_id) references public.schools(id) not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'achievement_awards_learner_id_fkey_secure') then
    alter table public.achievement_awards
      add constraint achievement_awards_learner_id_fkey_secure
      foreign key (learner_id) references public.learners(id) not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'achievement_awards_classroom_id_fkey_secure') then
    alter table public.achievement_awards
      add constraint achievement_awards_classroom_id_fkey_secure
      foreign key (classroom_id) references public.classrooms(id) not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'achievement_awards_teacher_id_fkey_secure') then
    alter table public.achievement_awards
      add constraint achievement_awards_teacher_id_fkey_secure
      foreign key (teacher_id) references public.profiles(id) not valid;
  end if;
end;
$$;

alter table public.achievement_awards
  drop constraint if exists achievement_awards_workflow_status_secure_check,
  drop constraint if exists achievement_awards_decline_reason_secure_check;

alter table public.achievement_awards
  add constraint achievement_awards_workflow_status_secure_check
  check (workflow_status in ('nominated', 'approved', 'declined', 'issued', 'revoked')) not valid,
  add constraint achievement_awards_decline_reason_secure_check
  check (workflow_status <> 'declined' or length(trim(coalesce(decline_reason, ''))) > 0) not valid;

create index if not exists achievement_awards_active_annual_nomination_lookup_idx
  on public.achievement_awards (school_id, learner_id, academic_year, lower(award_name))
  where deleted_at is null
    and academic_year is not null
    and workflow_status in ('nominated', 'approved', 'issued');

create index if not exists achievement_awards_school_status_period_idx
  on public.achievement_awards (school_id, workflow_status, academic_year, created_at desc);

create index if not exists achievement_awards_nominated_by_idx
  on public.achievement_awards (nominated_by, workflow_status, created_at desc);

-- Canonical school-membership checks used by both RLS and secure RPCs. These
-- functions deliberately exclude platform/master roles: Achievement Awards
-- are reviewed inside the school by its owner/principal or a specifically
-- delegated school administrator.
create or replace function public.can_manage_achievement_awards(p_school_id bigint)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.school_memberships membership
    where membership.user_id = auth.uid()
      and membership.school_id = p_school_id
      and membership.status = 'active'
      and (
        membership.role in ('owner', 'principal')
        or (
          membership.role = 'admin'
          and 'awards.manage' = any(coalesce(membership.permissions, '{}'::text[]))
        )
      )
  );
$$;

create or replace function public.can_nominate_achievement_awards(p_school_id bigint)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.school_memberships membership
    where membership.user_id = auth.uid()
      and membership.school_id = p_school_id
      and membership.status = 'active'
      and membership.role = 'teacher'
  );
$$;

revoke all on function public.can_manage_achievement_awards(bigint) from public, anon, authenticated;
revoke all on function public.can_nominate_achievement_awards(bigint) from public, anon, authenticated;
grant execute on function public.can_manage_achievement_awards(bigint) to authenticated;
grant execute on function public.can_nominate_achievement_awards(bigint) to authenticated;

-- This trigger prevents direct calls, server actions, and future clients from
-- bypassing learner/classroom/school/academic-year consistency checks.
create or replace function public.validate_annual_achievement_award()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_learner record;
  v_classroom_school_id bigint;
  v_practitioner_school_id bigint;
  v_year integer;
begin
  if new.school_id is null
     or new.learner_id is null
     or new.classroom_id is null
     or new.teacher_id is null then
    raise exception 'Annual awards require a learner, classroom, practitioner, and school.';
  end if;

  if length(trim(coalesce(new.award_name, ''))) = 0
     or length(trim(coalesce(new.award_reason, ''))) = 0 then
    raise exception 'An award name and reason are required.';
  end if;

  select l.school_id, l.classroom_id
    into v_learner
  from public.learners l
  where l.id = new.learner_id;

  if not found or v_learner.school_id is distinct from new.school_id then
    raise exception 'The learner does not belong to this school.';
  end if;

  if v_learner.classroom_id is distinct from new.classroom_id then
    raise exception 'The learner does not belong to the selected classroom.';
  end if;

  select c.school_id
    into v_classroom_school_id
  from public.classrooms c
  where c.id = new.classroom_id;

  if not found or v_classroom_school_id is distinct from new.school_id then
    raise exception 'The classroom does not belong to this school.';
  end if;

  select membership.school_id
    into v_practitioner_school_id
  from public.school_memberships membership
  where membership.user_id = new.teacher_id
    and membership.school_id = new.school_id
    and membership.status = 'active'
    and membership.role = 'teacher';

  if not found
     or v_practitioner_school_id is distinct from new.school_id then
    raise exception 'The practitioner does not belong to this school.';
  end if;

  if new.nominated_by is distinct from new.teacher_id then
    raise exception 'An award nomination must be attributed to its practitioner.';
  end if;

  v_year := coalesce(
    new.academic_year,
    new.award_year,
    extract(year from coalesce(new.issued_at, new.created_at, now()))::integer
  );
  new.academic_year := v_year;
  new.award_year := v_year;
  new.report_period_id := null;

  -- Serialize matching nominations so concurrent submissions cannot create two
  -- active awards for the same learner, academic year, and award name. This
  -- preserves any historic duplicates while preventing new ones safely.
  perform pg_advisory_xact_lock(
    hashtextextended(
      concat_ws(':', new.school_id, new.learner_id, new.academic_year, lower(trim(new.award_name))),
      0
    )
  );

  if new.deleted_at is null
     and new.workflow_status in ('nominated', 'approved', 'issued')
     and exists (
       select 1
       from public.achievement_awards existing
       where existing.id is distinct from new.id
         and existing.school_id = new.school_id
         and existing.learner_id = new.learner_id
         and existing.academic_year = new.academic_year
         and lower(trim(existing.award_name)) = lower(trim(new.award_name))
         and existing.deleted_at is null
         and existing.workflow_status in ('nominated', 'approved', 'issued')
     ) then
    raise exception 'This learner already has an active nomination for the same annual award.';
  end if;

  if new.workflow_status = 'declined' and length(trim(coalesce(new.decline_reason, ''))) = 0 then
    raise exception 'A reason is required when declining an award nomination.';
  end if;

  if tg_op = 'INSERT' then
    if new.workflow_status <> 'nominated' then
      raise exception 'New annual awards must begin as practitioner nominations.';
    end if;
  else
    if old.school_id is distinct from new.school_id
       or old.learner_id is distinct from new.learner_id
       or old.classroom_id is distinct from new.classroom_id
       or old.teacher_id is distinct from new.teacher_id
       or old.academic_year is distinct from new.academic_year
       or old.award_name is distinct from new.award_name
       or old.award_category is distinct from new.award_category
       or old.nominated_by is distinct from new.nominated_by then
      raise exception 'Award nomination details cannot be changed after submission.';
    end if;

    if (old.workflow_status = 'nominated' and new.workflow_status not in ('nominated', 'approved', 'declined'))
       or (old.workflow_status = 'approved' and new.workflow_status not in ('approved', 'issued'))
       or (old.workflow_status = 'issued' and new.workflow_status not in ('issued', 'revoked'))
       or (old.workflow_status in ('declined', 'revoked') and new.workflow_status <> old.workflow_status) then
      raise exception 'This award status transition is not allowed.';
    end if;
  end if;

  if new.workflow_status = 'issued' then
    new.certificate_generated := true;
    new.issued_at := coalesce(new.issued_at, now());
  end if;

  return new;
end;
$$;

drop trigger if exists prepare_annual_achievement_award_trigger on public.achievement_awards;
drop trigger if exists validate_annual_achievement_award_trigger on public.achievement_awards;

create trigger validate_annual_achievement_award_trigger
before insert or update on public.achievement_awards
for each row execute function public.validate_annual_achievement_award();

-- Existing policies allowed clients to write protected school, classroom,
-- practitioner and approval data directly. Remove every policy first, then add
-- read-only scoped access. All writes below occur through secure RPCs.
alter table public.achievement_awards enable row level security;

do $$
declare
  policy_row record;
begin
  for policy_row in
    select policyname
    from pg_policies
    where schemaname = 'public' and tablename = 'achievement_awards'
  loop
    execute format('drop policy if exists %I on public.achievement_awards', policy_row.policyname);
  end loop;
end;
$$;

create policy "Achievement awards read by authorised role"
on public.achievement_awards
for select
to authenticated
using (
  public.can_manage_achievement_awards(achievement_awards.school_id)
  or (
    public.can_nominate_achievement_awards(achievement_awards.school_id)
    and achievement_awards.nominated_by = auth.uid()
  )
);

alter table public.certificate_reprints
  add column if not exists learner_uuid uuid;

update public.certificate_reprints reprint
set learner_uuid = award.learner_id
from public.achievement_awards award
where award.id = reprint.certificate_id
  and reprint.learner_uuid is null;

alter table public.certificate_reprints
  alter column learner_id drop not null;

create index if not exists certificate_reprints_learner_uuid_secure_idx
  on public.certificate_reprints (learner_uuid, printed_at desc);

alter table public.certificate_reprints enable row level security;

do $$
declare
  policy_row record;
begin
  for policy_row in
    select policyname
    from pg_policies
    where schemaname = 'public' and tablename = 'certificate_reprints'
  loop
    execute format('drop policy if exists %I on public.certificate_reprints', policy_row.policyname);
  end loop;
end;
$$;

create policy "Achievement certificate reprints read by authorised role"
on public.certificate_reprints
for select
to authenticated
using (
  exists (
    select 1
    from public.achievement_awards award
    where award.id = certificate_reprints.certificate_id
      and (
        public.can_manage_achievement_awards(award.school_id)
        or (
          public.can_nominate_achievement_awards(award.school_id)
          and award.nominated_by = auth.uid()
        )
      )
  )
);

-- Keep the unsafe legacy reissue RPC inaccessible to browser clients. A future
-- reissue feature must derive every relationship from an issued award just as
-- the functions below do.
do $$
begin
  if to_regprocedure('public.reissue_achievement_award(bigint,jsonb)') is not null then
    execute 'revoke all on function public.reissue_achievement_award(bigint, jsonb) from public, anon, authenticated';
  end if;
end;
$$;

create or replace function public.create_annual_achievement_nomination(
  p_learner_id uuid,
  p_award_name text,
  p_award_category text,
  p_award_reason text
)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_profile jsonb;
  v_school_id bigint;
  v_classroom_id bigint;
  v_classroom_id_text text;
  v_classroom_name text;
  v_teacher_name text;
  v_learner record;
  v_year integer := extract(year from current_date)::integer;
  v_award_id bigint;
begin
  select to_jsonb(p) into v_profile
  from public.profiles p
  where p.id = auth.uid();

  if v_profile is null then
    raise exception 'Your account profile could not be found.';
  end if;

  v_school_id := nullif(v_profile ->> 'school_id', '')::bigint;
  if v_school_id is null then
    raise exception 'A school assignment is required before nominations can be made.';
  end if;

  if not public.can_nominate_achievement_awards(v_school_id) then
    raise exception 'Only an active practitioner may nominate learners for this school.';
  end if;

  v_classroom_id_text := coalesce(
    nullif(v_profile ->> 'classroom_id', ''),
    nullif(v_profile ->> 'assigned_classroom_id', '')
  );

  if coalesce(v_classroom_id_text, '') ~ '^[0-9]+$' then
    v_classroom_id := v_classroom_id_text::bigint;
  else
    v_classroom_name := coalesce(
      nullif(v_profile ->> 'classroom_name', ''),
      nullif(v_profile ->> 'assigned_classroom_name', ''),
      nullif(v_profile ->> 'classroom', '')
    );
    select c.id into v_classroom_id
    from public.classrooms c
    where c.school_id = v_school_id
      and lower(c.classroom_name) = lower(v_classroom_name)
    order by c.id
    limit 1;
  end if;

  if v_classroom_id is null
     or not exists (
       select 1 from public.classrooms c
       where c.id = v_classroom_id and c.school_id = v_school_id
     ) then
    raise exception 'Your principal must assign you to a classroom before you can nominate learners.';
  end if;

  select l.school_id, l.classroom_id
    into v_learner
  from public.learners l
  where l.id = p_learner_id;

  if not found
     or v_learner.school_id is distinct from v_school_id
     or v_learner.classroom_id is distinct from v_classroom_id then
    raise exception 'You can only nominate learners assigned to your classroom.';
  end if;

  if length(trim(coalesce(p_award_name, ''))) = 0
     or length(trim(coalesce(p_award_reason, ''))) = 0 then
    raise exception 'An award name and reason are required.';
  end if;

  v_teacher_name := coalesce(
    nullif(v_profile ->> 'full_name', ''),
    nullif(v_profile ->> 'name', ''),
    'Practitioner'
  );

  insert into public.achievement_awards (
    school_id, learner_id, classroom_id, teacher_id, report_period_id,
    award_name, award_category, award_reason, teacher_name,
    award_year, academic_year, workflow_status, nominated_by,
    certificate_generated
  ) values (
    v_school_id, p_learner_id, v_classroom_id, auth.uid(), null,
    trim(p_award_name), coalesce(nullif(trim(p_award_category), ''), 'General'), trim(p_award_reason), v_teacher_name,
    v_year, v_year, 'nominated', auth.uid(), false
  ) returning id into v_award_id;

  return v_award_id;
end;
$$;

create or replace function public.review_annual_achievement_nomination(
  p_nomination_id bigint,
  p_decision text,
  p_decline_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_profile jsonb;
  v_award public.achievement_awards%rowtype;
  v_principal_name text;
begin
  select to_jsonb(p) into v_profile
  from public.profiles p
  where p.id = auth.uid();

  if v_profile is null then
    raise exception 'Your account profile could not be found.';
  end if;

  select * into v_award
  from public.achievement_awards
  where id = p_nomination_id
    and deleted_at is null
  for update;

  if not found then
    raise exception 'The nomination could not be found.';
  end if;

  if not public.can_manage_achievement_awards(v_award.school_id) then
    raise exception 'Only this school''s owner, principal, or delegated administrator can review nominations.';
  end if;

  if v_award.workflow_status <> 'nominated' then
    raise exception 'Only pending nominations can be reviewed.';
  end if;

  v_principal_name := coalesce(nullif(v_profile ->> 'full_name', ''), nullif(v_profile ->> 'name', ''), 'Principal');

  if lower(coalesce(p_decision, '')) = 'approved' then
    update public.achievement_awards
    set workflow_status = 'approved',
        approved_by = auth.uid(),
        approved_at = now(),
        principal_name = v_principal_name,
        decline_reason = null,
        declined_at = null,
        declined_by = null
    where id = v_award.id;
  elsif lower(coalesce(p_decision, '')) = 'declined' then
    if length(trim(coalesce(p_decline_reason, ''))) = 0 then
      raise exception 'A reason is required when declining a nomination.';
    end if;

    update public.achievement_awards
    set workflow_status = 'declined',
        declined_by = auth.uid(),
        declined_at = now(),
        principal_name = v_principal_name,
        decline_reason = trim(p_decline_reason)
    where id = v_award.id;
  else
    raise exception 'The review decision must be approved or declined.';
  end if;
end;
$$;

create or replace function public.issue_approved_annual_achievement_award(
  p_nomination_id bigint
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_profile jsonb;
  v_award public.achievement_awards%rowtype;
  v_principal_name text;
begin
  select to_jsonb(p) into v_profile
  from public.profiles p
  where p.id = auth.uid();

  if v_profile is null then
    raise exception 'Your account profile could not be found.';
  end if;

  select * into v_award
  from public.achievement_awards
  where id = p_nomination_id
    and deleted_at is null
  for update;

  if not found then
    raise exception 'The approved nomination could not be found.';
  end if;

  if not public.can_manage_achievement_awards(v_award.school_id) then
    raise exception 'Only this school''s owner, principal, or delegated administrator can issue certificates.';
  end if;

  if v_award.workflow_status <> 'approved' then
    raise exception 'Only approved nominations can be issued as certificates.';
  end if;

  v_principal_name := coalesce(nullif(v_profile ->> 'full_name', ''), nullif(v_profile ->> 'name', ''), 'Principal');
  update public.achievement_awards
  set workflow_status = 'issued',
      approved_by = coalesce(approved_by, auth.uid()),
      approved_at = coalesce(approved_at, now()),
      principal_name = coalesce(nullif(principal_name, ''), v_principal_name),
      issued_at = now(),
      certificate_generated = true
  where id = v_award.id;
end;
$$;

create or replace function public.revoke_annual_achievement_award(
  p_award_id bigint,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_profile jsonb;
  v_award public.achievement_awards%rowtype;
begin
  if length(trim(coalesce(p_reason, ''))) = 0 then
    raise exception 'A reason is required when revoking a certificate.';
  end if;

  select to_jsonb(p) into v_profile
  from public.profiles p
  where p.id = auth.uid();

  if v_profile is null then
    raise exception 'Your account profile could not be found.';
  end if;

  select * into v_award
  from public.achievement_awards
  where id = p_award_id
    and deleted_at is null
  for update;

  if not found or v_award.workflow_status <> 'issued' then
    raise exception 'Only issued certificates can be revoked.';
  end if;

  if not public.can_manage_achievement_awards(v_award.school_id) then
    raise exception 'Only this school''s owner, principal, or delegated administrator can revoke certificates.';
  end if;

  update public.achievement_awards
  set workflow_status = 'revoked',
      revoked_at = now(),
      revoked_by = auth.uid(),
      revoke_reason = trim(p_reason),
      deleted_at = now()
  where id = v_award.id;
end;
$$;

create or replace function public.record_achievement_certificate_reprint(
  p_award_id bigint,
  p_action text default 'download'
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_profile jsonb;
  v_award public.achievement_awards%rowtype;
begin
  if lower(coalesce(p_action, '')) not in ('download', 'print', 'view') then
    raise exception 'The certificate action is not supported.';
  end if;

  select to_jsonb(p) into v_profile
  from public.profiles p
  where p.id = auth.uid();

  if v_profile is null then
    raise exception 'Your account profile could not be found.';
  end if;

  select * into v_award
  from public.achievement_awards
  where id = p_award_id
    and deleted_at is null;

  if not found or v_award.workflow_status <> 'issued' then
    raise exception 'Only issued certificates can be recorded.';
  end if;

  if not (
    public.can_manage_achievement_awards(v_award.school_id)
    or (
      public.can_nominate_achievement_awards(v_award.school_id)
      and v_award.nominated_by = auth.uid()
    )
  ) then
    raise exception 'You cannot access this certificate.';
  end if;

  insert into public.certificate_reprints (
    certificate_id, school_id, learner_uuid, printed_at, action, performed_by
  ) values (
    v_award.id, v_award.school_id, v_award.learner_id, now(), lower(p_action), auth.uid()
  );
end;
$$;

revoke all on function public.create_annual_achievement_nomination(uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.review_annual_achievement_nomination(bigint, text, text) from public, anon, authenticated;
revoke all on function public.issue_approved_annual_achievement_award(bigint) from public, anon, authenticated;
revoke all on function public.revoke_annual_achievement_award(bigint, text) from public, anon, authenticated;
revoke all on function public.record_achievement_certificate_reprint(bigint, text) from public, anon, authenticated;

grant execute on function public.create_annual_achievement_nomination(uuid, text, text, text) to authenticated;
grant execute on function public.review_annual_achievement_nomination(bigint, text, text) to authenticated;
grant execute on function public.issue_approved_annual_achievement_award(bigint) to authenticated;
grant execute on function public.revoke_annual_achievement_award(bigint, text) to authenticated;
grant execute on function public.record_achievement_certificate_reprint(bigint, text) to authenticated;
