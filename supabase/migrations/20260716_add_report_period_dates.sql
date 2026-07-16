alter table public.report_periods
  add column if not exists opening_date date,
  add column if not exists closing_date date;

comment on column public.report_periods.opening_date is
  'Default opening date used by every report generated for this period.';

comment on column public.report_periods.closing_date is
  'Default closing date used by every report generated for this period.';
