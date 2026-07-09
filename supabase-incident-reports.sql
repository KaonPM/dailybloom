create table if not exists public.incident_reports (
  id bigserial primary key,
  school_id bigint not null references public.schools(id) on delete cascade,
  learner_id text,
  learner_name text,
  classroom_name text,
  teacher_id uuid,
  teacher_name text,
  report_reference text,
  incident_date date not null,
  incident_time time not null,
  incident_location text not null,
  incident_type text not null,
  description text not null,
  first_aid_given text,
  action_taken text,
  parent_notified boolean default false,
  parent_notified_at timestamptz,
  witness_name text,
  front_injury_areas text[] default '{}',
  back_injury_areas text[] default '{}',
  photo_urls text[] default '{}',
  status text not null default 'submitted',
  principal_acknowledged_at timestamptz,
  principal_acknowledged_by text,
  principal_notes text,
  created_at timestamptz not null default now()
);

create index if not exists incident_reports_school_id_idx on public.incident_reports(school_id);
create index if not exists incident_reports_incident_date_idx on public.incident_reports(incident_date);

alter table public.incident_reports enable row level security;

drop policy if exists "incident reports same school select" on public.incident_reports;
create policy "incident reports same school select"
on public.incident_reports
for select
using (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
      and (
        profiles.role = 'master'
        or profiles.school_id = incident_reports.school_id
      )
  )
);

drop policy if exists "incident reports teacher insert" on public.incident_reports;
create policy "incident reports teacher insert"
on public.incident_reports
for insert
with check (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
      and profiles.role in ('teacher', 'principal', 'master')
      and (
        profiles.role = 'master'
        or profiles.school_id = incident_reports.school_id
      )
  )
);

drop policy if exists "incident reports principal update" on public.incident_reports;
create policy "incident reports principal update"
on public.incident_reports
for update
using (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
      and profiles.role in ('principal', 'master')
      and (
        profiles.role = 'master'
        or profiles.school_id = incident_reports.school_id
      )
  )
)
with check (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
      and profiles.role in ('principal', 'master')
      and (
        profiles.role = 'master'
        or profiles.school_id = incident_reports.school_id
      )
  )
);

insert into storage.buckets (id, name, public)
values ('incident-report-photos', 'incident-report-photos', true)
on conflict (id) do nothing;

drop policy if exists "incident report photos read" on storage.objects;
create policy "incident report photos read"
on storage.objects
for select
using (bucket_id = 'incident-report-photos');

drop policy if exists "incident report photos upload" on storage.objects;
create policy "incident report photos upload"
on storage.objects
for insert
with check (
  bucket_id = 'incident-report-photos'
  and auth.role() = 'authenticated'
);
