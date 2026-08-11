-- WhatsApp delivery and an additional parent verification step for public enrolment forms.
-- Existing parent portal, SMS and re-enrolment flows are unchanged.

alter table public.school_enrolment_enquiries
  add column if not exists form_access_otp_hash text,
  add column if not exists form_access_otp_expires_at timestamptz,
  add column if not exists form_access_otp_sent_at timestamptz,
  add column if not exists form_access_otp_resend_available_at timestamptz,
  add column if not exists form_access_otp_attempts integer not null default 0 check (form_access_otp_attempts >= 0),
  add column if not exists form_access_otp_send_count integer not null default 0 check (form_access_otp_send_count >= 0),
  add column if not exists form_access_otp_locked_until timestamptz,
  add column if not exists form_access_session_hash text,
  add column if not exists form_access_session_expires_at timestamptz,
  add column if not exists form_access_otp_provider_message_id text,
  add column if not exists form_access_otp_delivery_status text,
  add column if not exists form_access_otp_delivery_error text;

create index if not exists school_enrolment_enquiries_access_session_idx
  on public.school_enrolment_enquiries(form_access_session_hash)
  where form_access_session_hash is not null;
