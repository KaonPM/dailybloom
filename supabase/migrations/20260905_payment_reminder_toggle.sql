-- Schools can opt out of automated reminders while retaining their preferred
-- reminder day should they enable them again later.
alter table public.school_setup_settings
  add column if not exists payment_reminders_enabled boolean not null default true;
