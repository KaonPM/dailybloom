-- Add any missing DailyBloom universal consent defaults without editing or
-- deleting consent configuration already created by a school.
insert into public.school_enrolment_consents
  (school_id, title, wording, is_required, is_active, display_order)
select school.id, consent.title, consent.wording, consent.is_required, true, consent.display_order
from public.schools school
cross join (values
  (1, 'Emergency Medical Treatment', 'I authorise the school to obtain reasonable emergency medical assistance for the learner when necessary and when the parent or guardian cannot be reached promptly.', true),
  (2, 'Administration of Medication', 'I understand that medication may only be administered according to the school''s procedures and any instructions or authorisation provided by the parent or guardian.', true),
  (3, 'Educational Outings and Excursions', 'I give permission for the learner to participate in school-approved educational outings or excursions, subject to the school''s applicable procedures. A detailed consent request for a specific outing or excursion will be sent through the Parent Portal when required by the school.', false),
  (4, 'Electronic Communication', 'I consent to the school using the contact information supplied for relevant school communication, including WhatsApp, SMS, email or Parent Portal communication where applicable.', true),
  (5, 'Processing of Learner and Parent Information', 'I consent to the school processing the learner and parent or guardian information supplied for enrolment, administration, learner support and related school purposes.', true)
) as consent(display_order, title, wording, is_required)
where not exists (
  select 1 from public.school_enrolment_consents existing
  where existing.school_id = school.id
    and lower(trim(existing.title)) = lower(trim(consent.title))
);
