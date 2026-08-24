-- Typed agendas and minutes are stored independently of optional uploaded files.
alter table public.school_meetings
  add column if not exists agenda_content text,
  add column if not exists minutes_content text;
