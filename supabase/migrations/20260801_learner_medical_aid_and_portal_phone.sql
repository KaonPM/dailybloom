alter table public.learners
  add column if not exists has_medical_aid boolean not null default false,
  add column if not exists medical_aid_name text,
  add column if not exists medical_aid_number text,
  add column if not exists medical_aid_main_member text,
  add column if not exists medical_aid_phone text,
  add column if not exists family_doctor_name text,
  add column if not exists family_doctor_phone text,
  add column if not exists preferred_hospital text,
  add column if not exists allergies text,
  add column if not exists medical_conditions text,
  add column if not exists medical_instructions text;

create or replace function public.change_learner_parent_portal_phone(
  p_school_id bigint,
  p_learner_id uuid,
  p_new_phone text
)
returns table(old_phone text, new_phone text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old_phone text;
begin
  select nullif(trim(l.parent_phone), '')
  into v_old_phone
  from public.learners l
  where l.id = p_learner_id and l.school_id = p_school_id
  for update;

  if not found then
    raise exception 'Learner not found in the selected school.';
  end if;

  if v_old_phone = p_new_phone then
    return query select v_old_phone, p_new_phone;
    return;
  end if;

  delete from public.parent_access
  where learner_id = p_learner_id and phone = p_new_phone;

  update public.parent_access
  set phone = p_new_phone,
      session_token = null,
      session_token_hash = null,
      session_expires_at = null,
      reset_otp_hash = null,
      reset_otp_expires_at = null,
      reset_otp_attempts = 0
  where learner_id = p_learner_id;

  update public.learners
  set parent_phone = p_new_phone
  where id = p_learner_id and school_id = p_school_id;

  return query select v_old_phone, p_new_phone;
end;
$$;

revoke all on function public.change_learner_parent_portal_phone(bigint, uuid, text)
  from public, anon, authenticated;
grant execute on function public.change_learner_parent_portal_phone(bigint, uuid, text)
  to service_role;
