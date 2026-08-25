-- A teacher may only read reports they authored for learners in their current
-- classroom. This prevents historical reports from following a teacher after a
-- classroom reassignment.
drop policy if exists "Incident reports role scoped read" on public.incident_reports;

create policy "Incident reports role scoped read" on public.incident_reports
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
          and profile.role = 'teacher'
          and incident_reports.teacher_id = auth.uid()
          and nullif(trim(profile.classroom_name), '') is not null
          and exists (
            select 1
            from public.learners learner
            where learner.id = incident_reports.learner_id
              and learner.school_id = profile.school_id
              and lower(trim(coalesce(learner.class, ''))) = lower(trim(profile.classroom_name))
          )
        )
      )
  )
);
