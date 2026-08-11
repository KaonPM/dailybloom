-- One private, server-managed communication and notification history.
-- Run this after the 20260811 enrolment WhatsApp migrations. It records
-- parent-portal, in-app, push, SMS, WhatsApp and email activity without
-- storing PINs, access codes or raw provider webhook payloads.

create table if not exists public.communication_notifications (
  id uuid primary key default gen_random_uuid(),
  school_id bigint not null references public.schools(id) on delete cascade,
  learner_id uuid references public.learners(id) on delete set null,
  enrolment_enquiry_id uuid references public.school_enrolment_enquiries(id) on delete set null,
  recipient_user_id uuid references auth.users(id) on delete set null,
  recipient_name text,
  recipient_phone text,
  recipient_email text,
  recipient_count integer not null default 1 check (recipient_count >= 0),
  channel text not null check (channel in ('parent_portal', 'in_app', 'push', 'sms', 'whatsapp', 'email')),
  communication_type text not null default 'General update',
  direction text not null default 'outbound' check (direction in ('outbound', 'inbound', 'system')),
  source_type text not null default 'system',
  source_id text,
  subject text,
  body_preview text,
  provider_message_id text,
  status text not null default 'queued'
    check (status in ('queued', 'sending', 'sent', 'delivered', 'read', 'retry_scheduled', 'failed', 'skipped')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  next_retry_at timestamptz,
  sent_at timestamptz,
  delivered_at timestamptz,
  read_at timestamptz,
  failed_at timestamptz,
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_type, source_id, channel)
);

create unique index if not exists communication_notifications_provider_message_id_idx
  on public.communication_notifications(provider_message_id)
  where provider_message_id is not null;

create index if not exists communication_notifications_school_created_idx
  on public.communication_notifications(school_id, created_at desc);
create index if not exists communication_notifications_school_channel_created_idx
  on public.communication_notifications(school_id, channel, created_at desc);
create index if not exists communication_notifications_status_retry_idx
  on public.communication_notifications(status, next_retry_at)
  where status = 'retry_scheduled';

create or replace function public.set_communication_notification_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists communication_notifications_set_updated_at on public.communication_notifications;
create trigger communication_notifications_set_updated_at
before update on public.communication_notifications
for each row execute function public.set_communication_notification_updated_at();

alter table public.communication_notifications enable row level security;

comment on table public.communication_notifications is
  'Private, server-managed notification centre. PINs, OTPs and raw provider payloads are never stored.';
comment on column public.communication_notifications.body_preview is
  'Short operational preview only; never store passwords, OTPs, PINs or full sensitive documents.';

-- Backfill the existing generated parent-portal communication records.
insert into public.communication_notifications (
  school_id,
  recipient_name,
  recipient_phone,
  channel,
  communication_type,
  source_type,
  source_id,
  body_preview,
  status,
  sent_at,
  created_at
)
select
  c.school_id,
  c.learner_name,
  c.parent_phone,
  'parent_portal',
  coalesce(nullif(c.communication_type, ''), 'General update'),
  'communication',
  c.id::text,
  left(coalesce(c.message, ''), 500),
  case lower(coalesce(c.status, ''))
    when 'failed' then 'failed'
    when 'pending' then 'queued'
    when 'copied' then 'sent'
    else 'sent'
  end,
  case
    when c.sent_date is not null then c.sent_date::timestamptz
    else null
  end,
  coalesce(c.created_at, now())
from public.communications c
where c.school_id is not null
on conflict (source_type, source_id, channel) do nothing;

-- Backfill the secure enrolment WhatsApp delivery history. No OTP or access
-- code is copied into this notification centre, only its delivery state.
insert into public.communication_notifications (
  school_id,
  enrolment_enquiry_id,
  recipient_phone,
  channel,
  communication_type,
  source_type,
  source_id,
  provider_message_id,
  status,
  attempt_count,
  next_retry_at,
  sent_at,
  delivered_at,
  read_at,
  failed_at,
  error_message,
  metadata,
  created_at
)
select
  d.school_id,
  d.enquiry_id,
  d.recipient_phone,
  'whatsapp',
  case d.message_kind
    when 'registration' then 'Enrolment registration information'
    when 'form' then 'Enrolment form link'
    else 'Enrolment form access code'
  end,
  'whatsapp_enrolment',
  d.id::text,
  d.provider_message_id,
  d.status,
  d.attempt_count,
  d.next_retry_at,
  d.sent_at,
  d.delivered_at,
  d.read_at,
  d.failed_at,
  d.last_error,
  jsonb_build_object(
    'message_kind', d.message_kind,
    'template_name', d.template_name,
    'template_version', d.template_version,
    'template_category', d.template_category,
    'template_meta_id', d.template_meta_id
  ),
  d.created_at
from public.enrolment_message_deliveries d
on conflict (source_type, source_id, channel) do nothing;

-- Backfill historic parent messages without exposing them to anonymous users.
-- The body preview is the same content already visible to authorised school
-- staff in Messages; it lets the communication centre tell a complete story.
insert into public.communication_notifications (
  school_id,
  learner_id,
  recipient_user_id,
  recipient_name,
  channel,
  communication_type,
  source_type,
  source_id,
  subject,
  body_preview,
  status,
  sent_at,
  read_at,
  created_at
)
select
  m.school_id,
  m.learner_id,
  case
    when lower(coalesce(m.recipient_role, '')) <> 'parent'
      and m.recipient_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then m.recipient_id::uuid
    else null
  end,
  m.recipient_name,
  case when lower(coalesce(m.recipient_role, '')) = 'parent' then 'parent_portal' else 'in_app' end,
  'Direct message',
  'message',
  m.id::text,
  concat('Message from ', coalesce(nullif(m.sender_name, ''), 'DailyBloom')),
  left(coalesce(m.message, ''), 500),
  case when coalesce(m.is_read, false) then 'read' else 'sent' end,
  m.created_at,
  case when coalesce(m.is_read, false) then m.created_at else null end,
  m.created_at
from public.messages m
where m.school_id is not null
on conflict (source_type, source_id, channel) do nothing;

-- Keep parent-portal and in-app communication history complete for every
-- existing and future producer. This avoids requiring each feature route to
-- remember to write a second audit record.
create or replace function public.sync_communication_to_notification_centre()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.communication_notifications (
    school_id, recipient_name, recipient_phone, channel,
    communication_type, source_type, source_id, body_preview, status,
    sent_at, created_at
  ) values (
    new.school_id,
    new.learner_name,
    new.parent_phone,
    'parent_portal',
    coalesce(nullif(new.communication_type, ''), 'General update'),
    'communication',
    new.id::text,
    left(coalesce(new.message, ''), 500),
    case lower(coalesce(new.status, ''))
      when 'failed' then 'failed'
      when 'pending' then 'queued'
      when 'copied' then 'sent'
      else 'sent'
    end,
    case when new.sent_date is not null then new.sent_date::timestamptz else null end,
    coalesce(new.created_at, now())
  )
  on conflict (source_type, source_id, channel) do update set
    recipient_name = excluded.recipient_name,
    recipient_phone = excluded.recipient_phone,
    communication_type = excluded.communication_type,
    body_preview = excluded.body_preview,
    status = excluded.status,
    sent_at = excluded.sent_at;
  return new;
end;
$$;

drop trigger if exists communications_notification_centre_sync on public.communications;
create trigger communications_notification_centre_sync
after insert or update on public.communications
for each row execute function public.sync_communication_to_notification_centre();

create or replace function public.sync_message_to_notification_centre()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_channel text;
  target_user uuid;
begin
  target_channel := case
    when lower(coalesce(new.recipient_role, '')) = 'parent' then 'parent_portal'
    else 'in_app'
  end;
  target_user := case
    when target_channel <> 'parent_portal'
      and new.recipient_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then new.recipient_id::uuid
    else null
  end;

  insert into public.communication_notifications (
    school_id, learner_id, recipient_user_id, recipient_name, channel,
    communication_type, source_type, source_id, subject, body_preview,
    status, sent_at, read_at, created_at
  ) values (
    new.school_id,
    new.learner_id,
    target_user,
    new.recipient_name,
    target_channel,
    'Direct message',
    'message',
    new.id::text,
    concat('Message from ', coalesce(nullif(new.sender_name, ''), 'DailyBloom')),
    left(coalesce(new.message, ''), 500),
    case when coalesce(new.is_read, false) then 'read' else 'sent' end,
    new.created_at,
    case when coalesce(new.is_read, false) then now() else null end,
    new.created_at
  )
  on conflict (source_type, source_id, channel) do update set
    recipient_user_id = excluded.recipient_user_id,
    recipient_name = excluded.recipient_name,
    body_preview = excluded.body_preview,
    status = excluded.status,
    read_at = excluded.read_at;
  return new;
end;
$$;

drop trigger if exists messages_notification_centre_sync on public.messages;
create trigger messages_notification_centre_sync
after insert or update on public.messages
for each row execute function public.sync_message_to_notification_centre();

-- WhatsApp sends, retries and webhook delivery/read updates are already
-- persisted in enrolment_message_deliveries. Mirror that canonical history
-- here, while deliberately excluding the OTP/access-code value itself.
create or replace function public.sync_enrolment_whatsapp_to_notification_centre()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.communication_notifications (
    school_id, enrolment_enquiry_id, recipient_phone, channel,
    communication_type, source_type, source_id, provider_message_id,
    status, attempt_count, next_retry_at, sent_at, delivered_at, read_at,
    failed_at, error_message, metadata, created_at
  ) values (
    new.school_id,
    new.enquiry_id,
    new.recipient_phone,
    'whatsapp',
    case new.message_kind
      when 'registration' then 'Enrolment registration information'
      when 'form' then 'Enrolment form link'
      else 'Enrolment form access code'
    end,
    'whatsapp_enrolment',
    new.id::text,
    new.provider_message_id,
    new.status,
    new.attempt_count,
    new.next_retry_at,
    new.sent_at,
    new.delivered_at,
    new.read_at,
    new.failed_at,
    new.last_error,
    jsonb_build_object(
      'message_kind', new.message_kind,
      'template_name', new.template_name,
      'template_version', new.template_version,
      'template_category', new.template_category,
      'template_meta_id', new.template_meta_id
    ),
    new.created_at
  )
  on conflict (source_type, source_id, channel) do update set
    provider_message_id = excluded.provider_message_id,
    status = excluded.status,
    attempt_count = excluded.attempt_count,
    next_retry_at = excluded.next_retry_at,
    sent_at = excluded.sent_at,
    delivered_at = excluded.delivered_at,
    read_at = excluded.read_at,
    failed_at = excluded.failed_at,
    error_message = excluded.error_message,
    metadata = excluded.metadata;
  return new;
end;
$$;

drop trigger if exists enrolment_whatsapp_notification_centre_sync
  on public.enrolment_message_deliveries;
create trigger enrolment_whatsapp_notification_centre_sync
after insert or update on public.enrolment_message_deliveries
for each row execute function public.sync_enrolment_whatsapp_to_notification_centre();
