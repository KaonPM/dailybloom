-- Align incident report permissions with the roles supported by the application.
-- School leaders can create and manage reports, while classroom practitioners can
-- create reports only for learners currently assigned to their classroom.

drop policy if exists "incident reports teacher insert" on public.incident_reports;
drop policy if exists "Incident reports authorised staff insert" on public.incident_reports;
create policy "Incident reports authorised staff insert"
on public.incident_reports
for insert to authenticated
with check (
  teacher_id = auth.uid()
  and exists (
    select 1
    from public.profiles profile
    join public.learners learner
      on learner.id::text = incident_reports.learner_id
     and learner.school_id = incident_reports.school_id
    where profile.id = auth.uid()
      and (
        profile.role = 'master'
        or (
          profile.school_id = incident_reports.school_id
          and profile.role in ('owner', 'principal', 'admin')
        )
        or (
          profile.school_id = incident_reports.school_id
          and profile.role in ('teacher', 'practitioner', 'educator')
          and nullif(trim(profile.classroom_name), '') is not null
          and lower(trim(coalesce(learner.class, ''))) = lower(trim(profile.classroom_name))
        )
      )
  )
);

-- Preserve the classroom-scoped read rule with the legacy text learner key.
drop policy if exists "Incident reports role scoped read" on public.incident_reports;
create policy "Incident reports role scoped read"
on public.incident_reports
for select to authenticated
using (
  exists (
    select 1
    from public.profiles profile
    where profile.id = auth.uid()
      and (
        profile.role = 'master'
        or (
          profile.school_id = incident_reports.school_id
          and profile.role in ('owner', 'principal', 'admin')
        )
        or (
          profile.school_id = incident_reports.school_id
          and profile.role in ('teacher', 'practitioner', 'educator')
          and incident_reports.teacher_id = auth.uid()
          and nullif(trim(profile.classroom_name), '') is not null
          and exists (
            select 1
            from public.learners learner
            where learner.id::text = incident_reports.learner_id
              and learner.school_id = profile.school_id
              and lower(trim(coalesce(learner.class, ''))) = lower(trim(profile.classroom_name))
          )
        )
      )
  )
);

drop policy if exists "incident reports principal update" on public.incident_reports;
drop policy if exists "Incident reports school leaders update" on public.incident_reports;
create policy "Incident reports school leaders update"
on public.incident_reports
for update to authenticated
using (
  exists (
    select 1
    from public.profiles profile
    where profile.id = auth.uid()
      and (
        profile.role = 'master'
        or (
          profile.school_id = incident_reports.school_id
          and profile.role in ('owner', 'principal', 'admin')
        )
      )
  )
)
with check (
  exists (
    select 1
    from public.profiles profile
    where profile.id = auth.uid()
      and (
        profile.role = 'master'
        or (
          profile.school_id = incident_reports.school_id
          and profile.role in ('owner', 'principal', 'admin')
        )
      )
  )
);

drop policy if exists "Incident audit staff insert" on public.incident_report_audit;
drop policy if exists "Incident audit authorised staff insert" on public.incident_report_audit;
create policy "Incident audit authorised staff insert"
on public.incident_report_audit
for insert to authenticated
with check (
  actor_id = auth.uid()
  and exists (
    select 1
    from public.profiles profile
    where profile.id = auth.uid()
      and profile.role in ('teacher', 'practitioner', 'educator', 'owner', 'principal', 'admin', 'master')
      and (profile.role = 'master' or profile.school_id = incident_report_audit.school_id)
  )
);

drop policy if exists "Incident photos authenticated school upload" on storage.objects;
drop policy if exists "Incident photos authorised school upload" on storage.objects;
create policy "Incident photos authorised school upload"
on storage.objects
for insert to authenticated
with check (
  bucket_id = 'incident-report-photos'
  and exists (
    select 1
    from public.profiles profile
    where profile.id = auth.uid()
      and profile.role in ('teacher', 'practitioner', 'educator', 'owner', 'principal', 'admin', 'master')
      and (
        profile.role = 'master'
        or split_part(storage.objects.name, '/', 1) = profile.school_id::text
      )
  )
);

drop policy if exists "Incident photos uploader cleanup" on storage.objects;
create policy "Incident photos uploader cleanup"
on storage.objects
for delete to authenticated
using (
  bucket_id = 'incident-report-photos'
  and split_part(storage.objects.name, '/', 2) = auth.uid()::text
  and exists (
    select 1
    from public.profiles profile
    where profile.id = auth.uid()
      and (
        profile.role = 'master'
        or split_part(storage.objects.name, '/', 1) = profile.school_id::text
      )
  )
);
