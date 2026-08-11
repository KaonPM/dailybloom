-- Secure, server-managed WhatsApp delivery history for enrolment messages.
-- The application only queues Utility registration/form messages. Authentication
-- access codes are deliberately never stored or retried automatically.

create table if not exists public.enrolment_message_deliveries (
  id uuid primary key default gen_random_uuid(),
  enquiry_id uuid not null references public.school_enrolment_enquiries(id) on delete cascade,
  school_id bigint not null references public.schools(id) on delete cascade,
  channel text not null default 'whatsapp' check (channel = 'whatsapp'),
  message_kind text not null check (message_kind in ('registration', 'form', 'access_code')),
  template_name text not null,
  template_version text not null default '1',
  template_category text not null check (template_category in ('utility', 'authentication')),
  template_approved_at text,
  template_meta_id text,
  recipient_phone text not null,
  provider_message_id text,
  status text not null default 'sending'
    check (status in ('sending', 'sent', 'delivered', 'read', 'retry_scheduled', 'failed')),
  attempt_count integer not null default 1 check (attempt_count between 1 and 4),
  next_retry_at timestamptz,
  last_error text,
  retry_payload_encrypted text,
  sent_at timestamptz,
  delivered_at timestamptz,
  read_at timestamptz,
  failed_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists enrolment_message_deliveries_provider_message_id_idx
  on public.enrolment_message_deliveries(provider_message_id)
  where provider_message_id is not null;

create index if not exists enrolment_message_deliveries_enquiry_created_idx
  on public.enrolment_message_deliveries(enquiry_id, created_at desc);

create index if not exists enrolment_message_deliveries_retry_idx
  on public.enrolment_message_deliveries(status, next_retry_at)
  where status = 'retry_scheduled';

alter table public.enrolment_message_deliveries enable row level security;

comment on table public.enrolment_message_deliveries is
  'Private WhatsApp enrolment delivery audit trail. Written and read only through server routes using the service role.';
comment on column public.enrolment_message_deliveries.retry_payload_encrypted is
  'AES-GCM encrypted retry payload for Utility messages only. Authentication codes are never stored here.';
