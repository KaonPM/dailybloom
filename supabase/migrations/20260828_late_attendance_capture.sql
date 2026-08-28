alter table public.attendance
  add column if not exists late_capture_reason text;

comment on column public.attendance.late_capture_reason is
  'Optional operational reason recorded when attendance is captured after its attendance_date.';
