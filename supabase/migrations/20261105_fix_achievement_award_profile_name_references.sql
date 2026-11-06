-- Keep awards compatible with the production profiles table, which stores a
-- person's display name in full_name (there is no legacy name column).
create or replace function public.create_annual_achievement_nomination(p_learner_id uuid, p_award_name text, p_award_category text, p_award_reason text)
returns bigint language plpgsql security definer set search_path = public, pg_temp as $$
declare v_profile jsonb; v_school_id bigint; v_classroom_id bigint; v_classroom_id_text text; v_award_id bigint; v_year integer := extract(year from current_date)::integer;
begin
  select to_jsonb(profile) into v_profile from public.profiles profile where profile.id = auth.uid();
  if v_profile is null then raise exception 'Your account profile could not be found.'; end if;
  v_school_id := nullif(v_profile ->> 'school_id', '')::bigint;
  if v_school_id is null or not public.can_nominate_achievement_awards(v_school_id) then raise exception 'Only an active practitioner may nominate learners for this school.'; end if;
  v_classroom_id_text := nullif(coalesce(v_profile ->> 'classroom_id', v_profile ->> 'assigned_classroom_id'), '');
  if coalesce(v_classroom_id_text, '') ~ '^[0-9]+$' then v_classroom_id := v_classroom_id_text::bigint; end if;
  if v_classroom_id is null then
    select classroom.id into v_classroom_id from public.classrooms classroom
    where classroom.school_id = v_school_id and lower(classroom.classroom_name) = lower(coalesce(v_profile ->> 'classroom_name', v_profile ->> 'assigned_classroom_name', v_profile ->> 'classroom')) limit 1;
  end if;
  if v_classroom_id is null or not exists (select 1 from public.learners learner where learner.id = p_learner_id and learner.school_id = v_school_id and learner.classroom_id = v_classroom_id) then raise exception 'You can only nominate learners assigned to your classroom.'; end if;
  if length(trim(coalesce(p_award_name, ''))) = 0 or length(trim(coalesce(p_award_reason, ''))) = 0 then raise exception 'An award name and reason are required.'; end if;
  insert into public.achievement_awards (school_id, learner_id, classroom_id, teacher_id, report_period_id, award_name, award_category, award_reason, teacher_name, award_year, academic_year, workflow_status, nominated_by, certificate_generated)
  values (v_school_id, p_learner_id, v_classroom_id, auth.uid(), null, trim(p_award_name), coalesce(nullif(trim(p_award_category), ''), 'General'), trim(p_award_reason), coalesce(nullif(v_profile ->> 'full_name', ''), 'Practitioner'), v_year, v_year, 'nominated', auth.uid(), false)
  returning id into v_award_id;
  return v_award_id;
end;
$$;

create or replace function public.review_annual_achievement_nomination(p_nomination_id bigint, p_decision text, p_decline_reason text default null)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_award public.achievement_awards%rowtype; v_principal_name text;
begin
  select * into v_award from public.achievement_awards where id = p_nomination_id and deleted_at is null for update;
  if not found then raise exception 'The nomination could not be found.'; end if;
  if not public.can_manage_achievement_awards(v_award.school_id) then raise exception 'Only this school''s owner, principal, or delegated administrator can review nominations.'; end if;
  if v_award.workflow_status <> 'nominated' then raise exception 'Only pending nominations can be reviewed.'; end if;
  select coalesce(nullif(profile.full_name, ''), 'Principal') into v_principal_name from public.profiles profile where profile.id = auth.uid();
  if lower(coalesce(p_decision, '')) = 'approved' then
    update public.achievement_awards set workflow_status = 'approved', approved_by = auth.uid(), approved_at = now(), principal_name = v_principal_name, decline_reason = null, declined_at = null, declined_by = null where id = v_award.id;
  elsif lower(coalesce(p_decision, '')) = 'declined' then
    if length(trim(coalesce(p_decline_reason, ''))) = 0 then raise exception 'A reason is required when declining a nomination.'; end if;
    update public.achievement_awards set workflow_status = 'declined', declined_by = auth.uid(), declined_at = now(), principal_name = v_principal_name, decline_reason = trim(p_decline_reason) where id = v_award.id;
  else raise exception 'The review decision must be approved or declined.'; end if;
end;
$$;

create or replace function public.issue_approved_annual_achievement_award(p_nomination_id bigint)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_award public.achievement_awards%rowtype; v_principal_name text;
begin
  select * into v_award from public.achievement_awards where id = p_nomination_id and deleted_at is null for update;
  if not found or v_award.workflow_status <> 'approved' then raise exception 'Only approved nominations can be issued as certificates.'; end if;
  if not public.can_manage_achievement_awards(v_award.school_id) then raise exception 'Only this school''s owner, principal, or delegated administrator can issue certificates.'; end if;
  select coalesce(nullif(profile.full_name, ''), 'Principal') into v_principal_name from public.profiles profile where profile.id = auth.uid();
  update public.achievement_awards set workflow_status = 'issued', approved_by = coalesce(approved_by, auth.uid()), approved_at = coalesce(approved_at, now()), principal_name = coalesce(nullif(principal_name, ''), v_principal_name), issued_at = now(), certificate_generated = true where id = v_award.id;
end;
$$;

revoke all on function public.create_annual_achievement_nomination(uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.review_annual_achievement_nomination(bigint, text, text) from public, anon, authenticated;
revoke all on function public.issue_approved_annual_achievement_award(bigint) from public, anon, authenticated;
grant execute on function public.create_annual_achievement_nomination(uuid, text, text, text) to authenticated;
grant execute on function public.review_annual_achievement_nomination(bigint, text, text) to authenticated;
grant execute on function public.issue_approved_annual_achievement_award(bigint) to authenticated;
